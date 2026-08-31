import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CommunityReportStatus } from '@prisma/client';
import {
  CommunityBoardCategory,
  CommunityPostStatus,
  CommunityPostSurface,
  type Prisma,
  type UserRole,
  type WorkType,
} from '@prisma/client';
import type {
  CommunityCommentView,
  CommunityFeedScope,
  CommunityModerationReportView,
  CommunityPostView,
  CommunityPublicAuthor,
  CommunityReviewView,
  CreateCommunityPostRequest,
  CreateCommunityReportRequest,
} from '@work-archive/shared-types';

import type { PrismaService } from '../../../prisma/prisma.service';
import { parseAllowedImageUrl } from '../../image-proxy';

export const PUBLIC_AUTHOR_SELECT = {
  avatarUrl: true,
  handle: true,
  nickname: true,
} satisfies Prisma.UserSelect;

export const GUEST_REACTION_USER_ID = '00000000-0000-0000-0000-000000000000';

export interface CommunityPostReadModel {
  id: string;
  authorId: string;
  catalogTitleId: string | null;
  category: CommunityBoardCategory;
  commentCount: number;
  body: string;
  spoiler: boolean;
  workTitle: string;
  workType: WorkType | null;
  workThumbnailUrl: string;
  reactionCount: number;
  surface: CommunityPostSurface;
  createdAt: Date;
  updatedAt: Date;
  author: {
    avatarUrl: string;
    handle: string | null;
    nickname: string;
  };
  reactions: Array<{ id: string }>;
}

export interface CommunityReviewReadModel {
  id: string;
  authorId: string;
  rating: number | null;
  body: string;
  spoiler: boolean;
  reactionCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: CommunityPostReadModel['author'];
  catalogTitle: {
    id: string;
    displayTitle: string;
    mediumType: WorkType;
    thumbnailUrl: string;
    genres?: string[];
  };
  reactions: Array<{ id: string }>;
}

export interface CommunityCommentReadModel {
  id: string;
  authorId: string;
  body: string;
  spoiler: boolean;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: CommunityPostReadModel['author'];
  reactions: Array<{ id: string }>;
  replies?: CommunityCommentReadModel[];
}

export interface CommunityReportReadModel {
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
    surface: CommunityPostSurface;
    workThumbnailUrl: string;
    createdAt: Date;
  } | null;
  review: {
    id: string;
    body: string;
    rating: number | null;
    spoiler: boolean;
    createdAt: Date;
    catalogTitle: {
      id: string;
      displayTitle: string;
      mediumType: WorkType;
      thumbnailUrl: string;
    };
  } | null;
  comment: {
    id: string;
    body: string;
    spoiler: boolean;
    createdAt: Date;
  } | null;
}

export interface CommunityListInput {
  category?: CommunityBoardCategory;
  cursor?: string;
  limit: number;
  sort: 'latest' | 'popular';
}

export interface CommunityFeedInput extends CommunityListInput {
  scope: CommunityFeedScope;
}

export interface CommunityFeedCursor {
  createdAt: Date;
  id: string;
  kind: 'post' | 'review';
  reactionCount: number;
  sort: 'latest' | 'popular';
}

export interface ModeratorIdentity {
  role: UserRole | 'user' | 'moderator' | 'admin';
  userId: string;
}

export abstract class CommunityServiceBase {
  protected constructor(protected readonly prisma: PrismaService) {}

  protected async assertCommunityIdentity(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarUrl: true,
        handle: true,
        nickname: true,
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    if (!user.handle) {
      throw new ForbiddenException(
        'A unique handle is required to participate in Community.',
      );
    }
    return user;
  }

  protected async findCatalogTitleOrThrow(catalogTitleId: string) {
    const title = await this.prisma.catalogTitle.findUnique({
      where: { id: catalogTitleId },
      select: {
        displayTitle: true,
        id: true,
        mediumType: true,
        thumbnailUrl: true,
      },
    });
    if (!title) throw new NotFoundException('Catalog title not found.');
    return title;
  }

  protected async resolvePostWork(input: CreateCommunityPostRequest) {
    if (input.catalogTitleId) {
      const title = await this.findCatalogTitleOrThrow(input.catalogTitleId);
      return {
        catalogTitleId: title.id,
        thumbnailUrl: title.thumbnailUrl,
        title: title.displayTitle,
        type: title.mediumType,
      };
    }
    const snapshot = this.normalizeWorkSnapshot(input);
    return snapshot ? { ...snapshot, catalogTitleId: null } : null;
  }

  protected async assertVisibleTarget(
    targetType: 'post' | 'review',
    targetId: string,
  ) {
    const target =
      targetType === 'post'
        ? await this.prisma.communityPost.findFirst({
            where: {
              id: targetId,
              status: CommunityPostStatus.published,
              surface: CommunityPostSurface.board,
            },
            select: { authorId: true, id: true },
          })
        : await this.prisma.communityReview.findFirst({
            where: { id: targetId, status: CommunityPostStatus.published },
            select: { authorId: true, id: true },
          });
    if (!target) {
      throw new NotFoundException(`Community ${targetType} not found.`);
    }
    return target;
  }

  protected postInclude(viewerUserId: string | null) {
    return {
      author: { select: PUBLIC_AUTHOR_SELECT },
      reactions: {
        where: { userId: viewerUserId ?? GUEST_REACTION_USER_ID },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.CommunityPostInclude;
  }

  protected reviewInclude(viewerUserId: string | null) {
    return {
      author: { select: PUBLIC_AUTHOR_SELECT },
      catalogTitle: {
        select: {
          displayTitle: true,
          id: true,
          mediumType: true,
          thumbnailUrl: true,
        },
      },
      reactions: {
        where: { userId: viewerUserId ?? GUEST_REACTION_USER_ID },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.CommunityReviewInclude;
  }

  protected commentInclude(viewerUserId: string | null) {
    const reactionInclude = {
      where: { userId: viewerUserId ?? GUEST_REACTION_USER_ID },
      select: { id: true },
      take: 1,
    } as const;
    return {
      author: { select: PUBLIC_AUTHOR_SELECT },
      reactions: reactionInclude,
      replies: {
        where: { status: CommunityPostStatus.published },
        include: {
          author: { select: PUBLIC_AUTHOR_SELECT },
          reactions: reactionInclude,
          replies: false,
        },
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
      },
    } satisfies Prisma.CommunityCommentInclude;
  }

  protected postOrderBy(sort: CommunityListInput['sort']) {
    if (sort === 'popular') {
      return [
        { reactionCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ] satisfies Prisma.CommunityPostOrderByWithRelationInput[];
    }

    return [
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ] satisfies Prisma.CommunityPostOrderByWithRelationInput[];
  }

  protected reviewOrderBy(sort: CommunityListInput['sort']) {
    if (sort === 'popular') {
      return [
        { reactionCount: 'desc' as const },
        { createdAt: 'desc' as const },
        { id: 'desc' as const },
      ] satisfies Prisma.CommunityReviewOrderByWithRelationInput[];
    }
    return [
      { createdAt: 'desc' as const },
      { id: 'desc' as const },
    ] satisfies Prisma.CommunityReviewOrderByWithRelationInput[];
  }

  protected compareFeedCandidates(
    left: Pick<
      CommunityFeedCursor,
      'createdAt' | 'id' | 'kind' | 'reactionCount'
    >,
    right: Pick<
      CommunityFeedCursor,
      'createdAt' | 'id' | 'kind' | 'reactionCount'
    >,
    sort: CommunityListInput['sort'],
  ) {
    if (sort === 'popular' && left.reactionCount !== right.reactionCount) {
      return right.reactionCount - left.reactionCount;
    }
    const dateOrder = right.createdAt.getTime() - left.createdAt.getTime();
    if (dateOrder !== 0) return dateOrder;
    const idOrder = right.id.localeCompare(left.id);
    if (idOrder !== 0) return idOrder;
    return right.kind.localeCompare(left.kind);
  }

  protected encodeFeedCursor(
    candidate: Pick<
      CommunityFeedCursor,
      'createdAt' | 'id' | 'kind' | 'reactionCount'
    >,
    sort: CommunityListInput['sort'],
  ) {
    return Buffer.from(
      JSON.stringify({
        createdAt: candidate.createdAt.toISOString(),
        id: candidate.id,
        kind: candidate.kind,
        reactionCount: candidate.reactionCount,
        sort,
      }),
      'utf8',
    ).toString('base64url');
  }

  protected decodeFeedCursor(value: string): CommunityFeedCursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      if (
        (parsed.sort !== 'latest' && parsed.sort !== 'popular') ||
        (parsed.kind !== 'post' && parsed.kind !== 'review') ||
        typeof parsed.id !== 'string' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.reactionCount !== 'number'
      ) {
        throw new Error('Invalid cursor shape.');
      }
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid date.');
      return {
        createdAt,
        id: parsed.id,
        kind: parsed.kind,
        reactionCount: parsed.reactionCount,
        sort: parsed.sort,
      };
    } catch {
      throw new BadRequestException('cursor must be a valid community cursor.');
    }
  }

  protected normalizeWorkSnapshot(input: CreateCommunityPostRequest) {
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

    const thumbnailUrl = input.workThumbnailUrl?.trim();

    return {
      thumbnailUrl: thumbnailUrl
        ? parseAllowedImageUrl(thumbnailUrl).toString()
        : '',
      title,
      type: input.workType as WorkType,
    };
  }

  protected async findVisibleModerationTargetOrThrow(
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ) {
    const where = { id: targetId, status: CommunityPostStatus.published };
    const select = { authorId: true, id: true } as const;
    const target =
      targetType === 'post'
        ? await this.prisma.communityPost.findFirst({
            where: { ...where, surface: postSurface },
            select,
          })
        : targetType === 'review'
          ? await this.prisma.communityReview.findFirst({ where, select })
          : await this.prisma.communityComment.findFirst({ where, select });

    if (!target) {
      throw new NotFoundException(`Community ${targetType} not found.`);
    }

    return target;
  }

  protected assertModerator(role: ModeratorIdentity['role']) {
    if (role !== 'moderator' && role !== 'admin') {
      throw new ForbiddenException(
        'Community moderation requires moderator access.',
      );
    }
  }

  protected toPostView(
    post: CommunityPostReadModel,
    viewerUserId: string | null,
  ): CommunityPostView {
    return {
      author: this.toPublicAuthor(post.author),
      body: post.body,
      category: post.category ?? CommunityBoardCategory.free,
      commentCount: post.commentCount ?? 0,
      createdAt: post.createdAt.toISOString(),
      id: post.id,
      reactionCount: post.reactionCount,
      spoiler: post.spoiler,
      surface: post.surface,
      updatedAt: post.updatedAt.toISOString(),
      viewerCanDelete: viewerUserId === post.authorId,
      viewerHasReacted: post.reactions.length > 0,
      work:
        post.workTitle && post.workType
          ? {
              catalogTitleId: post.catalogTitleId,
              thumbnailUrl: post.workThumbnailUrl,
              title: post.workTitle,
              type: post.workType,
            }
          : null,
    };
  }

  protected toReviewView(
    review: CommunityReviewReadModel,
    viewerUserId: string | null,
  ): CommunityReviewView {
    return {
      author: this.toPublicAuthor(review.author),
      body: review.body,
      commentCount: review.commentCount,
      createdAt: review.createdAt.toISOString(),
      id: review.id,
      rating: review.rating,
      reactionCount: review.reactionCount,
      spoiler: review.spoiler,
      updatedAt: review.updatedAt.toISOString(),
      viewerCanDelete: viewerUserId === review.authorId,
      viewerCanEdit: viewerUserId === review.authorId,
      viewerHasReacted: review.reactions.length > 0,
      work: {
        catalogTitleId: review.catalogTitle.id,
        genres: [],
        thumbnailUrl: review.catalogTitle.thumbnailUrl,
        title: review.catalogTitle.displayTitle,
        type: review.catalogTitle.mediumType,
      },
    };
  }

  protected toCommentView(
    comment: CommunityCommentReadModel,
    viewerUserId: string | null,
  ): CommunityCommentView {
    return {
      author: this.toPublicAuthor(comment.author),
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      id: comment.id,
      parentId: comment.parentId,
      reactionCount: comment.reactionCount,
      replies: (comment.replies ?? []).map((reply) =>
        this.toCommentView(reply, viewerUserId),
      ),
      spoiler: comment.spoiler,
      updatedAt: comment.updatedAt.toISOString(),
      viewerCanDelete: viewerUserId === comment.authorId,
      viewerCanEdit: viewerUserId === comment.authorId,
      viewerHasReacted: comment.reactions.length > 0,
    };
  }

  protected toModerationReportView(
    report: CommunityReportReadModel,
  ): CommunityModerationReportView {
    return {
      comment: report.comment
        ? {
            body: report.comment.body,
            createdAt: report.comment.createdAt.toISOString(),
            id: report.comment.id,
            spoiler: report.comment.spoiler,
          }
        : null,
      createdAt: report.createdAt.toISOString(),
      detail: report.detail,
      id: report.id,
      post: report.post
        ? {
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
          }
        : null,
      reason: report.reason,
      reporter: this.toPublicAuthor(report.reporter),
      review: report.review
        ? {
            body: report.review.body,
            createdAt: report.review.createdAt.toISOString(),
            id: report.review.id,
            rating: report.review.rating,
            spoiler: report.review.spoiler,
            work: {
              catalogTitleId: report.review.catalogTitle.id,
              thumbnailUrl: report.review.catalogTitle.thumbnailUrl,
              title: report.review.catalogTitle.displayTitle,
              type: report.review.catalogTitle.mediumType,
            },
          }
        : null,
      status: report.status,
      targetType: report.post ? 'post' : report.review ? 'review' : 'comment',
    };
  }

  protected toPublicAuthor(author: {
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

  protected isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
