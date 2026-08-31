import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityBoardCategory,
  CommunityModerationAction,
  CommunityProfileVisibility,
  CommunityPostStatus,
  CommunityPostSurface,
  CommunityReportStatus,
  type Prisma,
  type UserRole,
  type WorkType,
} from '@prisma/client';
import type {
  CommunityBoardPostView,
  CommunityCommentView,
  CommunityFeedResponse,
  CommunityFeedScope,
  CommunityModerationReportListResponse,
  CommunityModerationReportView,
  CommunityMutationResponse,
  CommunityPostListResponse,
  CommunityPostView,
  CommunityPublicAuthor,
  CommunityProfileView,
  CommunityReviewView,
  CommunityTasteCandidate,
  CommunityTrendingWorkView,
  CreateCommunityCommentRequest,
  CreateCommunityPostRequest,
  CreateCommunityReportRequest,
  ResolveCommunityReportRequest,
  UpdateCommunityCommentRequest,
  UpdateCommunityProfileRequest,
  UpsertCommunityReviewRequest,
} from '@work-archive/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { parseAllowedImageUrl } from '../image-proxy';

const PUBLIC_AUTHOR_SELECT = {
  avatarUrl: true,
  handle: true,
  nickname: true,
} satisfies Prisma.UserSelect;

const GUEST_REACTION_USER_ID = '00000000-0000-0000-0000-000000000000';

interface CommunityPostReadModel {
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

interface CommunityReviewReadModel {
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

interface CommunityCommentReadModel {
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

interface CommunityListInput {
  category?: CommunityBoardCategory;
  cursor?: string;
  limit: number;
  sort: 'latest' | 'popular';
}

interface CommunityFeedInput extends CommunityListInput {
  scope: CommunityFeedScope;
}

interface CommunityFeedCursor {
  createdAt: Date;
  id: string;
  kind: 'post' | 'review';
  reactionCount: number;
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
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityPostListResponse> {
    const rows = await this.prisma.communityPost.findMany({
      where: {
        status: CommunityPostStatus.published,
        surface,
        ...(input.category ? { category: input.category } : {}),
      },
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
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityPostView> {
    await this.assertCommunityIdentity(authorId);
    if (
      surface === CommunityPostSurface.reflection &&
      input.category &&
      input.category !== CommunityBoardCategory.free
    ) {
      throw new BadRequestException('Short reflections cannot use board categories.');
    }
    const work = await this.resolvePostWork(input);
    const post = await this.prisma.communityPost.create({
      data: {
        authorId,
        body: input.body.trim(),
        catalogTitleId: work?.catalogTitleId ?? null,
        category:
          surface === CommunityPostSurface.reflection
            ? CommunityBoardCategory.free
            : (input.category ?? CommunityBoardCategory.free),
        spoiler: input.spoiler ?? false,
        surface,
        workThumbnailUrl: work?.thumbnailUrl ?? '',
        workTitle: work?.title ?? '',
        workType: work?.type ?? null,
      },
      include: this.postInclude(authorId),
    });

    return this.toPostView(post as CommunityPostReadModel, authorId);
  }

  async getPost(
    postId: string,
    viewerUserId: string | null,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityBoardPostView> {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        status: CommunityPostStatus.published,
        surface,
      },
      include: this.postInclude(viewerUserId),
    });

    if (!post) {
      throw new NotFoundException('Community post not found.');
    }

    return this.toPostView(
      post as CommunityPostReadModel,
      viewerUserId,
    ) as CommunityBoardPostView;
  }

  async deletePost(
    authorId: string,
    postId: string,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    const result = await this.prisma.communityPost.updateMany({
      where: {
        authorId,
        id: postId,
        status: CommunityPostStatus.published,
        surface,
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

  async listFeed(
    input: CommunityFeedInput,
    viewerUserId: string | null,
  ): Promise<CommunityFeedResponse> {
    let authorIds: string[] | undefined;

    if (input.scope === 'following') {
      if (!viewerUserId) return { items: [], nextCursor: null };
      const follows = await this.prisma.communityFollow.findMany({
        where: { followerId: viewerUserId },
        select: { followingId: true },
        take: 500,
      });
      authorIds = follows.map((follow) => follow.followingId);
      if (authorIds.length === 0) return { items: [], nextCursor: null };
    }

    const take = Math.min(200, Math.max(input.limit * 6, 40));
    const [posts, reviews] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: {
          status: CommunityPostStatus.published,
          surface: CommunityPostSurface.board,
          ...(authorIds ? { authorId: { in: authorIds } } : {}),
        },
        include: this.postInclude(viewerUserId),
        orderBy: this.postOrderBy(input.sort),
        take,
      }),
      this.prisma.communityReview.findMany({
        where: {
          status: CommunityPostStatus.published,
          ...(authorIds ? { authorId: { in: authorIds } } : {}),
        },
        include: this.reviewInclude(viewerUserId),
        orderBy: this.reviewOrderBy(input.sort),
        take,
      }),
    ]);

    const candidates = [
      ...(posts as CommunityPostReadModel[]).map((post) => ({
        createdAt: post.createdAt,
        id: post.id,
        kind: 'post' as const,
        post: this.toPostView(post, viewerUserId) as CommunityBoardPostView,
        reactionCount: post.reactionCount,
        review: null,
      })),
      ...(reviews as CommunityReviewReadModel[]).map((review) => ({
        createdAt: review.createdAt,
        id: review.id,
        kind: 'review' as const,
        post: null,
        reactionCount: review.reactionCount,
        review: this.toReviewView(review, viewerUserId),
      })),
    ].sort((left, right) => this.compareFeedCandidates(left, right, input.sort));

    const cursor = input.cursor ? this.decodeFeedCursor(input.cursor) : null;
    const remaining = cursor
      ? candidates.filter(
          (candidate) =>
            this.compareFeedCandidates(candidate, cursor, input.sort) > 0,
        )
      : candidates;
    const page = remaining.slice(0, input.limit);

    return {
      items: page.map(({ createdAt, reactionCount: _reactionCount, ...item }) => ({
        ...item,
        createdAt: createdAt.toISOString(),
      })),
      nextCursor:
        remaining.length > input.limit && page.length > 0
          ? this.encodeFeedCursor(page[page.length - 1]!, input.sort)
          : null,
    };
  }

  async listTrendingWorks(limit = 5): Promise<CommunityTrendingWorkView[]> {
    const [reviewGroups, postGroups] = await Promise.all([
      this.prisma.communityReview.groupBy({
        by: ['catalogTitleId'],
        where: { status: CommunityPostStatus.published },
        _avg: { rating: true },
        _count: { _all: true },
        orderBy: { _count: { catalogTitleId: 'desc' } },
        take: Math.max(limit * 3, 10),
      }),
      this.prisma.communityPost.groupBy({
        by: ['catalogTitleId'],
        where: {
          catalogTitleId: { not: null },
          status: CommunityPostStatus.published,
          surface: CommunityPostSurface.board,
        },
        _count: { _all: true },
        orderBy: { _count: { catalogTitleId: 'desc' } },
        take: Math.max(limit * 3, 10),
      }),
    ]);

    const totals = new Map<
      string,
      { averageRating: number | null; discussionCount: number; reviewCount: number }
    >();
    for (const group of reviewGroups) {
      totals.set(group.catalogTitleId, {
        averageRating: group._avg.rating,
        discussionCount: 0,
        reviewCount: group._count._all,
      });
    }
    for (const group of postGroups) {
      if (!group.catalogTitleId) continue;
      const current = totals.get(group.catalogTitleId) ?? {
        averageRating: null,
        discussionCount: 0,
        reviewCount: 0,
      };
      current.discussionCount = group._count._all;
      totals.set(group.catalogTitleId, current);
    }

    let titleIds = [...totals.entries()]
      .sort(
        (left, right) =>
          right[1].reviewCount + right[1].discussionCount -
          (left[1].reviewCount + left[1].discussionCount),
      )
      .slice(0, limit)
      .map(([id]) => id);
    if (titleIds.length < limit) {
      const fallback = await this.prisma.catalogTitle.findMany({
        where: { id: { notIn: titleIds } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: {
          displayTitle: true,
          id: true,
          mediumType: true,
          thumbnailUrl: true,
        },
        take: limit - titleIds.length,
      });
      titleIds = [...titleIds, ...fallback.map((title) => title.id)];
    }

    const titles = await this.prisma.catalogTitle.findMany({
      where: { id: { in: titleIds } },
      select: {
        displayTitle: true,
        id: true,
        mediumType: true,
        thumbnailUrl: true,
      },
    });
    const titleById = new Map(titles.map((title) => [title.id, title]));

    return titleIds.flatMap((id) => {
      const title = titleById.get(id);
      if (!title) return [];
      const counts = totals.get(id) ?? {
        averageRating: null,
        discussionCount: 0,
        reviewCount: 0,
      };
      return [
        {
          ...counts,
          work: {
            catalogTitleId: id,
            thumbnailUrl: title.thumbnailUrl,
            title: title.displayTitle,
            type: title.mediumType,
          },
        },
      ];
    });
  }

  async listReviewsByWork(
    catalogTitleId: string,
    input: CommunityListInput,
    viewerUserId: string | null,
  ): Promise<{ nextCursor: string | null; reviews: CommunityReviewView[] }> {
    await this.findCatalogTitleOrThrow(catalogTitleId);
    const rows = await this.prisma.communityReview.findMany({
      where: { catalogTitleId, status: CommunityPostStatus.published },
      include: this.reviewInclude(viewerUserId),
      orderBy: this.reviewOrderBy(input.sort),
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, input.limit) as CommunityReviewReadModel[];
    return {
      nextCursor:
        rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
      reviews: page.map((review) => this.toReviewView(review, viewerUserId)),
    };
  }

  async getReview(
    reviewId: string,
    viewerUserId: string | null,
  ): Promise<CommunityReviewView> {
    const review = await this.prisma.communityReview.findFirst({
      where: { id: reviewId, status: CommunityPostStatus.published },
      include: this.reviewInclude(viewerUserId),
    });
    if (!review) throw new NotFoundException('Community review not found.');
    return this.toReviewView(review as CommunityReviewReadModel, viewerUserId);
  }

  async upsertReview(
    authorId: string,
    catalogTitleId: string,
    input: UpsertCommunityReviewRequest,
  ): Promise<CommunityReviewView> {
    await this.assertCommunityIdentity(authorId);
    await this.findCatalogTitleOrThrow(catalogTitleId);
    const body = input.body?.trim() ?? '';
    const rating = input.rating ?? null;
    if (!body && rating === null) {
      throw new BadRequestException('A rating or review body is required.');
    }
    if (rating !== null && Math.round(rating * 2) !== rating * 2) {
      throw new BadRequestException('Rating must use 0.5 increments.');
    }

    const review = await this.prisma.communityReview.upsert({
      where: { authorId_catalogTitleId: { authorId, catalogTitleId } },
      create: {
        authorId,
        body,
        catalogTitleId,
        rating,
        spoiler: input.spoiler ?? false,
      },
      update: {
        body,
        deletedAt: null,
        hiddenAt: null,
        rating,
        spoiler: input.spoiler ?? false,
        status: CommunityPostStatus.published,
      },
      include: this.reviewInclude(authorId),
    });
    return this.toReviewView(review as CommunityReviewReadModel, authorId);
  }

  async deleteReview(
    authorId: string,
    catalogTitleId: string,
  ): Promise<CommunityMutationResponse> {
    const result = await this.prisma.communityReview.updateMany({
      where: {
        authorId,
        catalogTitleId,
        status: CommunityPostStatus.published,
      },
      data: { deletedAt: new Date(), status: CommunityPostStatus.deleted },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Community review not found.');
    }
    return { ok: true };
  }

  async listComments(
    targetType: 'post' | 'review',
    targetId: string,
    viewerUserId: string | null,
  ): Promise<CommunityCommentView[]> {
    await this.assertVisibleTarget(targetType, targetId);
    const rows = await this.prisma.communityComment.findMany({
      where: {
        parentId: null,
        status: CommunityPostStatus.published,
        ...(targetType === 'post' ? { postId: targetId } : { reviewId: targetId }),
      },
      include: this.commentInclude(viewerUserId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
    return (rows as unknown as CommunityCommentReadModel[]).map((comment) =>
      this.toCommentView(comment, viewerUserId),
    );
  }

  async createComment(
    authorId: string,
    input: CreateCommunityCommentRequest,
  ): Promise<CommunityCommentView> {
    await this.assertCommunityIdentity(authorId);
    const target = await this.assertVisibleTarget(input.targetType, input.targetId);
    if (input.parentId) {
      const parent = await this.prisma.communityComment.findFirst({
        where: {
          id: input.parentId,
          parentId: null,
          status: CommunityPostStatus.published,
          ...(input.targetType === 'post'
            ? { postId: input.targetId }
            : { reviewId: input.targetId }),
        },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Replies may only target a top-level comment.');
      }
    }

    const comment = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.communityComment.create({
        data: {
          authorId,
          body: input.body.trim(),
          parentId: input.parentId ?? null,
          postId: input.targetType === 'post' ? input.targetId : null,
          reviewId: input.targetType === 'review' ? input.targetId : null,
          spoiler: input.spoiler ?? false,
        },
        include: this.commentInclude(authorId),
      });
      if (input.targetType === 'post') {
        await transaction.communityPost.update({
          where: { id: input.targetId },
          data: { commentCount: { increment: 1 } },
        });
      } else {
        await transaction.communityReview.update({
          where: { id: input.targetId },
          data: { commentCount: { increment: 1 } },
        });
      }
      if (target.authorId !== authorId) {
        await transaction.communityNotification.create({
          data: {
            actorId: authorId,
            recipientId: target.authorId,
            targetId: input.targetId,
            targetType: input.targetType,
            type: 'comment',
          },
        });
      }
      return created;
    });

    return this.toCommentView(
      comment as unknown as CommunityCommentReadModel,
      authorId,
    );
  }

  async updateComment(
    authorId: string,
    commentId: string,
    input: UpdateCommunityCommentRequest,
  ): Promise<CommunityCommentView> {
    const updated = await this.prisma.communityComment.updateMany({
      where: {
        authorId,
        id: commentId,
        status: CommunityPostStatus.published,
      },
      data: { body: input.body.trim(), spoiler: input.spoiler ?? false },
    });
    if (updated.count !== 1) {
      throw new NotFoundException('Community comment not found.');
    }
    const comment = await this.prisma.communityComment.findUnique({
      where: { id: commentId },
      include: this.commentInclude(authorId),
    });
    if (!comment) throw new NotFoundException('Community comment not found.');
    return this.toCommentView(
      comment as unknown as CommunityCommentReadModel,
      authorId,
    );
  }

  async deleteComment(
    authorId: string,
    commentId: string,
  ): Promise<CommunityMutationResponse> {
    await this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.communityComment.findFirst({
        where: {
          authorId,
          id: commentId,
          status: CommunityPostStatus.published,
        },
        select: { postId: true, reviewId: true },
      });
      if (!comment) throw new NotFoundException('Community comment not found.');
      await transaction.communityComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), status: CommunityPostStatus.deleted },
      });
      if (comment.postId) {
        await transaction.communityPost.updateMany({
          where: { commentCount: { gt: 0 }, id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        });
      } else if (comment.reviewId) {
        await transaction.communityReview.updateMany({
          where: { commentCount: { gt: 0 }, id: comment.reviewId },
          data: { commentCount: { decrement: 1 } },
        });
      }
    });
    return { ok: true };
  }

  async setTargetReaction(
    userId: string,
    targetType: 'comment' | 'review',
    targetId: string,
    reacted: boolean,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(userId);
    await this.prisma.$transaction(async (transaction) => {
      if (targetType === 'review') {
        const review = await transaction.communityReview.findFirst({
          where: { id: targetId, status: CommunityPostStatus.published },
          select: { authorId: true },
        });
        if (!review) throw new NotFoundException('Community review not found.');
        const change = reacted
          ? await transaction.communityReviewReaction.createMany({
              data: [{ reviewId: targetId, userId }],
              skipDuplicates: true,
            })
          : await transaction.communityReviewReaction.deleteMany({
              where: { reviewId: targetId, userId },
            });
        if (change.count === 1) {
          const updated = await transaction.communityReview.updateMany({
            where: {
              id: targetId,
              ...(reacted ? {} : { reactionCount: { gt: 0 } }),
            },
            data: {
              reactionCount: reacted ? { increment: 1 } : { decrement: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new NotFoundException('Community review not found.');
          }
          if (reacted && review.authorId !== userId) {
            await transaction.communityNotification.create({
              data: {
                actorId: userId,
                recipientId: review.authorId,
                targetId,
                targetType,
                type: 'reaction',
              },
            });
          }
        }
        return;
      }

      const comment = await transaction.communityComment.findFirst({
        where: { id: targetId, status: CommunityPostStatus.published },
        select: { authorId: true },
      });
      if (!comment) throw new NotFoundException('Community comment not found.');
      const change = reacted
        ? await transaction.communityCommentReaction.createMany({
            data: [{ commentId: targetId, userId }],
            skipDuplicates: true,
          })
        : await transaction.communityCommentReaction.deleteMany({
            where: { commentId: targetId, userId },
          });
      if (change.count === 1) {
        const updated = await transaction.communityComment.updateMany({
          where: {
            id: targetId,
            ...(reacted ? {} : { reactionCount: { gt: 0 } }),
          },
          data: {
            reactionCount: reacted ? { increment: 1 } : { decrement: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new NotFoundException('Community comment not found.');
        }
      }
    });
    return { ok: true };
  }

  async getProfile(
    handle: string,
    viewerUserId: string | null,
  ): Promise<CommunityProfileView> {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        avatarUrl: true,
        communityProfile: true,
        handle: true,
        id: true,
        nickname: true,
      },
    });
    if (!user) throw new NotFoundException('Community profile not found.');
    const profile = user.communityProfile;
    const viewerCanEdit = viewerUserId === user.id;
    const isPrivate =
      !profile || profile.visibility === CommunityProfileVisibility.private;
    const sections = {
      showBoardPosts: profile?.showBoardPosts ?? false,
      showFollowers: profile?.showFollowers ?? false,
      showRatings: profile?.showRatings ?? false,
      showReviews: profile?.showReviews ?? false,
      showTasteSummary: profile?.showTasteSummary ?? false,
    };
    const canShowDetails = !isPrivate || viewerCanEdit;
    const [recentPosts, recentReviews, favoriteWorks, followerCount, followingCount, follow] =
      await Promise.all([
        canShowDetails && sections.showBoardPosts
          ? this.prisma.communityPost.findMany({
              where: {
                authorId: user.id,
                status: CommunityPostStatus.published,
                surface: CommunityPostSurface.board,
              },
              include: this.postInclude(viewerUserId),
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 6,
            })
          : [],
        canShowDetails && sections.showReviews
          ? this.prisma.communityReview.findMany({
              where: { authorId: user.id, status: CommunityPostStatus.published },
              include: this.reviewInclude(viewerUserId),
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 6,
            })
          : [],
        canShowDetails && profile?.favoriteCatalogTitleIds.length
          ? this.prisma.catalogTitle.findMany({
              where: { id: { in: profile.favoriteCatalogTitleIds } },
              select: {
                displayTitle: true,
                id: true,
                mediumType: true,
                thumbnailUrl: true,
              },
            })
          : [],
        canShowDetails && sections.showFollowers
          ? this.prisma.communityFollow.count({ where: { followingId: user.id } })
          : null,
        canShowDetails && sections.showFollowers
          ? this.prisma.communityFollow.count({ where: { followerId: user.id } })
          : null,
        viewerUserId
          ? this.prisma.communityFollow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: viewerUserId,
                  followingId: user.id,
                },
              },
              select: { id: true },
            })
          : null,
      ]);

    return {
      allowFollowers: profile?.allowFollowers ?? true,
      author: this.toPublicAuthor(user),
      bio: canShowDetails ? (profile?.bio ?? '') : '',
      favoriteGenres:
        canShowDetails && sections.showTasteSummary
          ? (profile?.favoriteGenres ?? [])
          : [],
      favoriteWorks: favoriteWorks.map((title) => ({
        catalogTitleId: title.id,
        thumbnailUrl: title.thumbnailUrl,
        title: title.displayTitle,
        type: title.mediumType,
      })),
      followerCount,
      followingCount,
      isPrivate,
      ...(viewerCanEdit
        ? {
            notifications: {
              browser: profile?.notifyBrowser ?? false,
              globalBadge: profile?.notifyGlobalBadge ?? false,
              inCommunity: profile?.notifyInCommunity ?? true,
            },
          }
        : {}),
      recentPosts: (recentPosts as CommunityPostReadModel[]).map((post) =>
        this.toPostView(post, viewerUserId) as CommunityBoardPostView,
      ),
      recentReviews: (recentReviews as CommunityReviewReadModel[]).map((review) =>
        this.toReviewView(review, viewerUserId),
      ),
      sections,
      viewerCanEdit,
      viewerCanFollow:
        Boolean(viewerUserId && viewerUserId !== user.id) &&
        (profile?.allowFollowers ?? true),
      viewerIsFollowing: Boolean(follow),
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateCommunityProfileRequest,
  ): Promise<CommunityProfileView> {
    const identity = await this.assertCommunityIdentity(userId);
    const favoriteIds = [...new Set(input.favoriteCatalogTitleIds)].slice(0, 12);
    if (favoriteIds.length) {
      const count = await this.prisma.catalogTitle.count({
        where: { id: { in: favoriteIds } },
      });
      if (count !== favoriteIds.length) {
        throw new BadRequestException('One or more favorite works were not found.');
      }
    }
    await this.prisma.userCommunityProfile.upsert({
      where: { userId },
      create: {
        allowFollowers: input.allowFollowers,
        bio: input.bio.trim(),
        favoriteCatalogTitleIds: favoriteIds,
        favoriteGenres: [...new Set(input.favoriteGenres.map((genre) => genre.trim()).filter(Boolean))].slice(0, 12),
        notifyBrowser: input.notifications.browser,
        notifyGlobalBadge: input.notifications.globalBadge,
        notifyInCommunity: input.notifications.inCommunity,
        showBoardPosts: input.sections.showBoardPosts,
        showFollowers: input.sections.showFollowers,
        showRatings: input.sections.showRatings,
        showReviews: input.sections.showReviews,
        showTasteSummary: input.sections.showTasteSummary,
        userId,
        visibility: input.visibility,
      },
      update: {
        allowFollowers: input.allowFollowers,
        bio: input.bio.trim(),
        favoriteCatalogTitleIds: favoriteIds,
        favoriteGenres: [...new Set(input.favoriteGenres.map((genre) => genre.trim()).filter(Boolean))].slice(0, 12),
        notifyBrowser: input.notifications.browser,
        notifyGlobalBadge: input.notifications.globalBadge,
        notifyInCommunity: input.notifications.inCommunity,
        showBoardPosts: input.sections.showBoardPosts,
        showFollowers: input.sections.showFollowers,
        showRatings: input.sections.showRatings,
        showReviews: input.sections.showReviews,
        showTasteSummary: input.sections.showTasteSummary,
        visibility: input.visibility,
      },
    });
    return this.getProfile(identity.handle!, userId);
  }

  async setFollow(
    followerId: string,
    handle: string,
    following: boolean,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(followerId);
    const target = await this.prisma.user.findUnique({
      where: { handle },
      select: { communityProfile: { select: { allowFollowers: true } }, id: true },
    });
    if (!target) throw new NotFoundException('Community profile not found.');
    if (target.id === followerId) {
      throw new BadRequestException('Users cannot follow themselves.');
    }
    if (target.communityProfile?.allowFollowers === false) {
      throw new ForbiddenException('This profile does not accept followers.');
    }
    if (following) {
      const created = await this.prisma.communityFollow.createMany({
        data: [{ followerId, followingId: target.id }],
        skipDuplicates: true,
      });
      if (created.count === 1) {
        await this.prisma.communityNotification.create({
          data: {
            actorId: followerId,
            recipientId: target.id,
            targetId: followerId,
            targetType: 'profile',
            type: 'follow',
          },
        });
      }
    } else {
      await this.prisma.communityFollow.deleteMany({
        where: { followerId, followingId: target.id },
      });
    }
    return { ok: true };
  }

  async listTasteCandidates(viewerUserId: string): Promise<CommunityTasteCandidate[]> {
    await this.assertCommunityIdentity(viewerUserId);
    const profiles = await this.prisma.userCommunityProfile.findMany({
      where: {
        showTasteSummary: true,
        userId: { not: viewerUserId },
        visibility: CommunityProfileVisibility.public,
      },
      include: {
        user: {
          select: {
            avatarUrl: true,
            communityReviews: {
              where: {
                rating: { not: null },
                status: CommunityPostStatus.published,
              },
              select: {
                catalogTitleId: true,
                rating: true,
                catalogTitle: { select: { mediumType: true } },
              },
              take: 200,
            },
            handle: true,
            nickname: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    return profiles.map((profile) => {
      const genres: Record<string, number> = {};
      const types: Partial<Record<WorkType, number>> = {};
      const catalogRatings: Record<string, number> = {};
      for (const genre of profile.favoriteGenres) {
        genres[genre] = (genres[genre] ?? 0) + 2;
      }
      for (const review of profile.user.communityReviews) {
        if (review.rating !== null) catalogRatings[review.catalogTitleId] = review.rating;
        types[review.catalogTitle.mediumType] =
          (types[review.catalogTitle.mediumType] ?? 0) + 1;
      }
      return {
        author: this.toPublicAuthor(profile.user),
        fingerprint: { catalogRatings, genres, tags: {}, types },
      };
    });
  }

  async listNotifications(userId: string) {
    return this.prisma.communityNotification.findMany({
      where: { recipientId: userId },
      include: { actor: { select: PUBLIC_AUTHOR_SELECT } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async markNotificationsRead(userId: string): Promise<CommunityMutationResponse> {
    await this.prisma.communityNotification.updateMany({
      where: { readAt: null, recipientId: userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async addReaction(
    userId: string,
    postId: string,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(userId);
    await this.prisma.$transaction(async (transaction) => {
      const post = await transaction.communityPost.findFirst({
        where: {
          id: postId,
          status: CommunityPostStatus.published,
          surface,
        },
        select: { id: true },
      });

      if (!post) {
        throw new NotFoundException('Community post not found.');
      }

      const created = await transaction.communityReaction.createMany({
        data: [{ postId, userId }],
        skipDuplicates: true,
      });

      if (created.count === 1) {
        const updated = await transaction.communityPost.updateMany({
          where: { id: postId, status: CommunityPostStatus.published, surface },
          data: { reactionCount: { increment: 1 } },
        });

        if (updated.count !== 1) {
          throw new NotFoundException('Community post not found.');
        }
      }
    });

    return { ok: true };
  }

  async removeReaction(
    userId: string,
    postId: string,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(userId);
    await this.prisma.$transaction(async (transaction) => {
      const post = await transaction.communityPost.findFirst({
        where: {
          id: postId,
          status: CommunityPostStatus.published,
          surface,
        },
        select: { id: true },
      });

      if (!post) {
        throw new NotFoundException('Community post not found.');
      }

      const deleted = await transaction.communityReaction.deleteMany({
        where: { postId, userId },
      });

      if (deleted.count === 1) {
        const updated = await transaction.communityPost.updateMany({
          where: {
            id: postId,
            reactionCount: { gt: 0 },
            status: CommunityPostStatus.published,
            surface,
          },
          data: { reactionCount: { decrement: 1 } },
        });

        if (updated.count !== 1) {
          throw new NotFoundException('Community post not found.');
        }
      }
    });

    return { ok: true };
  }

  async reportPost(
    reporterId: string,
    postId: string,
    input: CreateCommunityReportRequest,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'post', postId, input, surface);
  }

  async reportReview(
    reporterId: string,
    reviewId: string,
    input: CreateCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'review', reviewId, input);
  }

  async reportComment(
    reporterId: string,
    commentId: string,
    input: CreateCommunityReportRequest,
  ): Promise<CommunityMutationResponse> {
    return this.reportTarget(reporterId, 'comment', commentId, input);
  }

  private async reportTarget(
    reporterId: string,
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    input: CreateCommunityReportRequest,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(reporterId);
    const target = await this.findVisibleModerationTargetOrThrow(
      targetType,
      targetId,
      postSurface,
    );

    if (target.authorId === reporterId) {
      throw new BadRequestException(
        targetType === 'post'
          ? 'Authors cannot report their own post.'
          : 'Authors cannot report their own content.',
      );
    }

    const targetWhere = { [`${targetType}Id`]: targetId };
    const existing = targetType === 'post'
      ? await this.prisma.communityReport.findUnique({
          where: { postId_reporterId: { postId: targetId, reporterId } },
          select: { id: true },
        })
      : targetType === 'review'
        ? await this.prisma.communityReport.findUnique({
            where: { reviewId_reporterId: { reviewId: targetId, reporterId } },
            select: { id: true },
          })
        : await this.prisma.communityReport.findUnique({
            where: { commentId_reporterId: { commentId: targetId, reporterId } },
            select: { id: true },
          });

    if (existing) {
      throw new ConflictException(
        targetType === 'post'
          ? 'This post has already been reported.'
          : 'This content has already been reported.',
      );
    }

    try {
      await this.prisma.communityReport.create({
        data: {
          detail: input.detail?.trim() ?? '',
          ...targetWhere,
          reason: input.reason,
          reporterId,
        } as Prisma.CommunityReportUncheckedCreateInput,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          targetType === 'post'
            ? 'This post has already been reported.'
            : 'This content has already been reported.',
        );
      }

      throw error;
    }

    return { ok: true };
  }

  async listReports(
    moderator: ModeratorIdentity,
    scope: 'reflection' | 'social' = 'social',
  ): Promise<CommunityModerationReportListResponse> {
    this.assertModerator(moderator.role);
    const reports = await this.prisma.communityReport.findMany({
      where: {
        status: CommunityReportStatus.pending,
        ...(scope === 'reflection'
          ? {
              post: {
                is: { surface: CommunityPostSurface.reflection },
              },
            }
          : {
              OR: [
                { post: { is: { surface: CommunityPostSurface.board } } },
                { reviewId: { not: null } },
                { commentId: { not: null } },
              ],
            }),
      },
      include: {
        comment: {
          select: {
            body: true,
            createdAt: true,
            id: true,
            spoiler: true,
          },
        },
        post: {
          select: {
            body: true,
            createdAt: true,
            id: true,
            spoiler: true,
            workThumbnailUrl: true,
            workTitle: true,
            workType: true,
            surface: true,
          },
        },
        reporter: { select: PUBLIC_AUTHOR_SELECT },
        review: {
          select: {
            body: true,
            catalogTitle: {
              select: {
                displayTitle: true,
                id: true,
                mediumType: true,
                thumbnailUrl: true,
              },
            },
            createdAt: true,
            id: true,
            rating: true,
            spoiler: true,
          },
        },
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
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.moderateTarget(
      moderator,
      'post',
      postId,
      'hide',
      note,
      surface,
    );
  }

  async hideReview(moderator: ModeratorIdentity, reviewId: string, note = '') {
    return this.moderateTarget(moderator, 'review', reviewId, 'hide', note);
  }

  async hideComment(moderator: ModeratorIdentity, commentId: string, note = '') {
    return this.moderateTarget(moderator, 'comment', commentId, 'hide', note);
  }

  async restorePost(
    moderator: ModeratorIdentity,
    postId: string,
    note = '',
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    return this.moderateTarget(
      moderator,
      'post',
      postId,
      'restore',
      note,
      surface,
    );
  }

  async restoreReview(moderator: ModeratorIdentity, reviewId: string, note = '') {
    return this.moderateTarget(moderator, 'review', reviewId, 'restore', note);
  }

  async restoreComment(moderator: ModeratorIdentity, commentId: string, note = '') {
    return this.moderateTarget(moderator, 'comment', commentId, 'restore', note);
  }

  private async moderateTarget(
    moderator: ModeratorIdentity,
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    operation: 'hide' | 'restore',
    note: string,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    await this.prisma.$transaction(async (transaction) => {
      const expectedStatus = operation === 'hide'
        ? CommunityPostStatus.published
        : CommunityPostStatus.hidden;
      const nextStatus = operation === 'hide'
        ? CommunityPostStatus.hidden
        : CommunityPostStatus.published;
      const data = {
        hiddenAt: operation === 'hide' ? new Date() : null,
        status: nextStatus,
      };
      let result: { count: number };
      let existing: { status: CommunityPostStatus } | null = null;
      if (targetType === 'post') {
        result = await transaction.communityPost.updateMany({
          where: {
            id: targetId,
            status: expectedStatus,
            surface: postSurface,
          },
          data,
        });
        if (result.count !== 1) {
          existing = await transaction.communityPost.findFirst({
            where: { id: targetId, surface: postSurface },
            select: { status: true },
          });
        }
      } else if (targetType === 'review') {
        result = await transaction.communityReview.updateMany({
          where: { id: targetId, status: expectedStatus }, data,
        });
        if (result.count !== 1) existing = await transaction.communityReview.findUnique({ where: { id: targetId }, select: { status: true } });
      } else {
        result = await transaction.communityComment.updateMany({
          where: { id: targetId, status: expectedStatus }, data,
        });
        if (result.count !== 1) existing = await transaction.communityComment.findUnique({ where: { id: targetId }, select: { status: true } });
      }

      if (result.count !== 1) {
        if (operation === 'hide' && existing?.status === CommunityPostStatus.hidden) return;
        throw new NotFoundException(`Community ${targetType} not found.`);
      }

      const action = `${targetType}_${operation === 'hide' ? 'hidden' : 'restored'}` as CommunityModerationAction;
      await transaction.communityModerationAuditLog.create({
        data: {
          action,
          actorId: moderator.userId,
          note: note.trim(),
          [`${targetType}Id`]: targetId,
        } as Prisma.CommunityModerationAuditLogUncheckedCreateInput,
      });
    });

    return { ok: true };
  }

  async resolveReport(
    moderator: ModeratorIdentity,
    reportId: string,
    input: ResolveCommunityReportRequest,
    scope: 'reflection' | 'social' = 'social',
  ): Promise<CommunityMutationResponse> {
    this.assertModerator(moderator.role);
    const dismissed = input.resolution === 'dismiss';
    await this.prisma.$transaction(async (transaction) => {
      const report = await transaction.communityReport.findUnique({
        where: { id: reportId },
        select: {
          commentId: true,
          postId: true,
          post: { select: { surface: true } },
          reviewId: true,
          status: true,
        },
      });

      const belongsToScope =
        report &&
        (scope === 'reflection'
          ? report.post?.surface === CommunityPostSurface.reflection
          : report.post?.surface === CommunityPostSurface.board ||
            report.reviewId !== null ||
            report.commentId !== null);

      if (
        !report ||
        report.status !== CommunityReportStatus.pending ||
        !belongsToScope
      ) {
        throw new NotFoundException('Pending community report not found.');
      }

      const result = await transaction.communityReport.updateMany({
        where: {
          id: reportId,
          status: CommunityReportStatus.pending,
        },
        data: {
          moderatorId: moderator.userId,
          moderatorNote: input.note?.trim() ?? '',
          resolvedAt: new Date(),
          status: dismissed
            ? CommunityReportStatus.dismissed
            : CommunityReportStatus.resolved,
        },
      });

      if (result.count !== 1) {
        throw new NotFoundException('Pending community report not found.');
      }

      await transaction.communityModerationAuditLog.create({
        data: {
          action: dismissed
            ? CommunityModerationAction.report_dismissed
            : CommunityModerationAction.report_resolved,
          actorId: moderator.userId,
          note: input.note?.trim() ?? '',
          commentId: report.commentId,
          postId: report.postId,
          reportId,
          reviewId: report.reviewId,
        },
      });
    });

    return { ok: true };
  }

  private async assertCommunityIdentity(userId: string) {
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

  private async findCatalogTitleOrThrow(catalogTitleId: string) {
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

  private async resolvePostWork(input: CreateCommunityPostRequest) {
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

  private async assertVisibleTarget(
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

  private postInclude(viewerUserId: string | null) {
    return {
      author: { select: PUBLIC_AUTHOR_SELECT },
      reactions: {
        where: { userId: viewerUserId ?? GUEST_REACTION_USER_ID },
        select: { id: true },
        take: 1,
      },
    } satisfies Prisma.CommunityPostInclude;
  }

  private reviewInclude(viewerUserId: string | null) {
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

  private commentInclude(viewerUserId: string | null) {
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

  private postOrderBy(sort: CommunityListInput['sort']) {
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

  private reviewOrderBy(sort: CommunityListInput['sort']) {
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

  private compareFeedCandidates(
    left: Pick<CommunityFeedCursor, 'createdAt' | 'id' | 'kind' | 'reactionCount'>,
    right: Pick<CommunityFeedCursor, 'createdAt' | 'id' | 'kind' | 'reactionCount'>,
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

  private encodeFeedCursor(
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

  private decodeFeedCursor(value: string): CommunityFeedCursor {
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

    const thumbnailUrl = input.workThumbnailUrl?.trim();

    return {
      thumbnailUrl: thumbnailUrl
        ? parseAllowedImageUrl(thumbnailUrl).toString()
        : '',
      title,
      type: input.workType as WorkType,
    };
  }

  private async findVisiblePostOrThrow(
    postId: string,
    surface: CommunityPostSurface = CommunityPostSurface.board,
  ) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, status: CommunityPostStatus.published, surface },
      select: { authorId: true, id: true },
    });

    if (!post) {
      throw new NotFoundException('Community post not found.');
    }

    return post;
  }

  private async findVisibleModerationTargetOrThrow(
    targetType: 'post' | 'review' | 'comment',
    targetId: string,
    postSurface: CommunityPostSurface = CommunityPostSurface.board,
  ) {
    const where = { id: targetId, status: CommunityPostStatus.published };
    const select = { authorId: true, id: true } as const;
    const target = targetType === 'post'
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

  private toReviewView(
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

  private toCommentView(
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

  private toModerationReportView(
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
