import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityModerationAction,
  CommunityPostStatus,
  CommunityReportStatus,
  type Prisma,
  type UserRole,
  type WorkType,
} from '@prisma/client';
import type {
  CommunityModerationReportListResponse,
  CommunityModerationReportView,
  CommunityMutationResponse,
  CommunityPostListResponse,
  CommunityPostView,
  CommunityPublicAuthor,
  CreateCommunityPostRequest,
  CreateCommunityReportRequest,
  ResolveCommunityReportRequest,
} from '@work-archive/shared-types';

import { PrismaService } from '../../prisma/prisma.service';

const PUBLIC_AUTHOR_SELECT = {
  avatarUrl: true,
  handle: true,
  nickname: true,
} satisfies Prisma.UserSelect;

const GUEST_REACTION_USER_ID = '00000000-0000-0000-0000-000000000000';

interface CommunityPostReadModel {
  id: string;
  authorId: string;
  body: string;
  spoiler: boolean;
  workTitle: string;
  workType: WorkType | null;
  workThumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    avatarUrl: string;
    handle: string | null;
    nickname: string;
  };
  reactions: Array<{ id: string }>;
  _count: { reactions: number };
}

interface CommunityReportReadModel {
  id: string;
  reason: CreateCommunityReportRequest['reason'];
  detail: string;
  status: CommunityReportStatus;
  createdAt: Date;
  reporter: CommunityPostReadModel['author'];
  post: {
    id: string;
    body: string;
    spoiler: boolean;
    workTitle: string;
    workType: WorkType | null;
    workThumbnailUrl: string;
    createdAt: Date;
  };
}

interface CommunityListInput {
  cursor?: string;
  limit: number;
  sort: 'latest' | 'popular';
}

interface ModeratorIdentity {
  role: UserRole | 'user' | 'moderator' | 'admin';
  userId: string;
}

@Injectable()
export class CommunityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPosts(
    input: CommunityListInput,
    viewerUserId: string | null,
  ): Promise<CommunityPostListResponse> {
    const rows = await this.prisma.communityPost.findMany({
      where: { status: CommunityPostStatus.published },
      include: this.postInclude(viewerUserId),
      orderBy: this.postOrderBy(input.sort),
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit) as CommunityPostReadModel[];

    return {
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      posts: page.map((post) => this.toPostView(post, viewerUserId)),
    };
  }

  async createPost(
    authorId: string,
    input: CreateCommunityPostRequest,
  ): Promise<CommunityPostView> {
    const work = this.normalizeWorkSnapshot(input);
    const post = await this.prisma.communityPost.create({
      data: {
        authorId,
        body: input.body.trim(),
        spoiler: input.spoiler ?? false,
        workThumbnailUrl: work?.thumbnailUrl ?? '',
        workTitle: work?.title ?? '',
        workType: work?.type ?? null,
      },
      include: this.postInclude(authorId),
    });

    return this.toPostView(post as CommunityPostReadModel, authorId);
  }

  async deletePost(
    authorId: string,
    postId: string,
  ): Promise<CommunityMutationResponse> {
    const result = await this.prisma.communityPost.updateMany({
      where: {
        authorId,
        id: postId,
        status: CommunityPostStatus.published,
      },
      data: {
        deletedAt: new Date(),
        status: CommunityPostStatus.deleted,
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Community post not found.');
    }

    return { ok: true };
  }

  async addReaction(
    userId: string,
    postId: string,
  ): Promise<CommunityMutationResponse> {
    await this.findVisiblePostOrThrow(postId);
    await this.prisma.communityReaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId },
      update: {},
    });

    return { ok: true };
  }

  async removeReaction(
    userId: string,
    postId: string,
  ): Promise<CommunityMutationResponse> {
    await this.findVisiblePostOrThrow(postId);
    await this.prisma.communityReaction.deleteMany({
      where: { postId, userId },
    });

    return { ok: true };
  }

  async reportPost(
    reporterId: string,
    postId: string,
    input: CreateCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    const post = await this.findVisiblePostOrThrow(postId);

    if (post.authorId === reporterId) {
      throw new BadRequestException('Authors cannot report their own post.');
    }

    const existing = await this.prisma.communityReport.findUnique({
      where: { postId_reporterId: { postId, reporterId } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('This post has already been reported.');
    }

    try {
      await this.prisma.communityReport.create({
        data: {
          detail: input.detail?.trim() ?? '',
          postId,
          reason: input.reason,
          reporterId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('This post has already been reported.');
      }

      throw error;
    }

    return { ok: true };
  }

  async listReports(
    moderator: ModeratorIdentity,
  ): Promise<CommunityModerationReportListResponse> {
    this.assertModerator(moderator.role);
    const reports = await this.prisma.communityReport.findMany({
      where: { status: CommunityReportStatus.pending },
      include: {
        post: {
          select: {
            body: true,
            createdAt: true,
            id: true,
            spoiler: true,
            workThumbnailUrl: true,
            workTitle: true,
            workType: true,
          },
        },
        reporter: { select: PUBLIC_AUTHOR_SELECT },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });

    return {
      reports: (reports as CommunityReportReadModel[]).map((report) =>
        this.toModerationReportView(report),
      ),
    };
  }

  async hidePost(
    moderator: ModeratorIdentity,
    postId: string,
    note = '',
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    await this.prisma.$transaction(async (transaction) => {
      const post = await transaction.communityPost.findUnique({
        where: { id: postId },
        select: { status: true },
      });

      if (!post || post.status === CommunityPostStatus.deleted) {
        throw new NotFoundException('Community post not found.');
      }

      if (post.status === CommunityPostStatus.hidden) {
        return;
      }

      await transaction.communityPost.update({
        where: { id: postId },
        data: {
          hiddenAt: new Date(),
          status: CommunityPostStatus.hidden,
        },
      });
      await transaction.communityModerationAuditLog.create({
        data: {
          action: CommunityModerationAction.post_hidden,
          actorId: moderator.userId,
          note: note.trim(),
          postId,
        },
      });
    });

    return { ok: true };
  }

  async restorePost(
    moderator: ModeratorIdentity,
    postId: string,
    note = '',
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    await this.prisma.$transaction(async (transaction) => {
      const post = await transaction.communityPost.findUnique({
        where: { id: postId },
        select: { status: true },
      });

      if (!post || post.status !== CommunityPostStatus.hidden) {
        throw new NotFoundException('Hidden community post not found.');
      }

      await transaction.communityPost.update({
        where: { id: postId },
        data: {
          hiddenAt: null,
          status: CommunityPostStatus.published,
        },
      });
      await transaction.communityModerationAuditLog.create({
        data: {
          action: CommunityModerationAction.post_restored,
          actorId: moderator.userId,
          note: note.trim(),
          postId,
        },
      });
    });

    return { ok: true };
  }

  async resolveReport(
    moderator: ModeratorIdentity,
    reportId: string,
    input: ResolveCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    const dismissed = input.resolution === 'dismiss';
    await this.prisma.$transaction(async (transaction) => {
      const report = await transaction.communityReport.findUnique({
        where: { id: reportId },
        select: { postId: true, status: true },
      });

      if (!report || report.status !== CommunityReportStatus.pending) {
        throw new NotFoundException('Pending community report not found.');
      }

      await transaction.communityReport.update({
        where: { id: reportId },
        data: {
          moderatorId: moderator.userId,
          moderatorNote: input.note?.trim() ?? '',
          resolvedAt: new Date(),
          status: dismissed
            ? CommunityReportStatus.dismissed
            : CommunityReportStatus.resolved,
        },
      });
      await transaction.communityModerationAuditLog.create({
        data: {
          action: dismissed
            ? CommunityModerationAction.report_dismissed
            : CommunityModerationAction.report_resolved,
          actorId: moderator.userId,
          note: input.note?.trim() ?? '',
          postId: report.postId,
          reportId,
        },
      });
    });

    return { ok: true };
  }

  private postInclude(viewerUserId: string | null) {
    return {
      _count: { select: { reactions: true } },
      author: { select: PUBLIC_AUTHOR_SELECT },
      reactions: {
        where: { userId: viewerUserId ?? GUEST_REACTION_USER_ID },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.CommunityPostInclude;
  }

  private postOrderBy(sort: CommunityListInput['sort']) {
    if (sort === 'popular') {
      return [
        { reactions: { _count: 'desc' as const } },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ] satisfies Prisma.CommunityPostOrderByWithRelationInput[];
    }

    return [
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ] satisfies Prisma.CommunityPostOrderByWithRelationInput[];
  }

  private normalizeWorkSnapshot(input: CreateCommunityPostRequest) {
    const title = input.workTitle?.trim() ?? '';
    const hasAnyWorkField = Boolean(
      title || input.workType || input.workThumbnailUrl,
    );

    if (!hasAnyWorkField) {
      return null;
    }

    if (!title || !input.workType) {
      throw new BadRequestException(
        'A community work snapshot requires title and type.',
      );
    }

    return {
      thumbnailUrl: input.workThumbnailUrl?.trim() ?? '',
      title,
      type: input.workType as WorkType,
    };
  }

  private async findVisiblePostOrThrow(postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, status: CommunityPostStatus.published },
      select: { authorId: true, id: true },
    });

    if (!post) {
      throw new NotFoundException('Community post not found.');
    }

    return post;
  }

  private assertModerator(role: ModeratorIdentity['role']) {
    if (role !== 'moderator' && role !== 'admin') {
      throw new ForbiddenException(
        'Community moderation requires moderator access.',
      );
    }
  }

  private toPostView(
    post: CommunityPostReadModel,
    viewerUserId: string | null,
  ): CommunityPostView {
    return {
      author: this.toPublicAuthor(post.author),
      body: post.body,
      createdAt: post.createdAt.toISOString(),
      id: post.id,
      reactionCount: post._count.reactions,
      spoiler: post.spoiler,
      updatedAt: post.updatedAt.toISOString(),
      viewerCanDelete: viewerUserId === post.authorId,
      viewerHasReacted: post.reactions.length > 0,
      work:
        post.workTitle && post.workType
          ? {
              thumbnailUrl: post.workThumbnailUrl,
              title: post.workTitle,
              type: post.workType,
            }
          : null,
    };
  }

  private toModerationReportView(
    report: CommunityReportReadModel,
  ): CommunityModerationReportView {
    return {
      createdAt: report.createdAt.toISOString(),
      detail: report.detail,
      id: report.id,
      post: {
        body: report.post.body,
        createdAt: report.post.createdAt.toISOString(),
        id: report.post.id,
        spoiler: report.post.spoiler,
        work:
          report.post.workTitle && report.post.workType
            ? {
                thumbnailUrl: report.post.workThumbnailUrl,
                title: report.post.workTitle,
                type: report.post.workType,
              }
            : null,
      },
      reason: report.reason,
      reporter: this.toPublicAuthor(report.reporter),
      status: report.status,
    };
  }

  private toPublicAuthor(author: {
    avatarUrl: string;
    handle: string | null;
    nickname: string;
  }): CommunityPublicAuthor {
    return {
      avatarUrl: author.avatarUrl,
      displayName: author.nickname.trim() || author.handle || '익명 사용자',
      handle: author.handle,
    };
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
