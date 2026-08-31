import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CommunityPostStatus, CommunityPostSurface } from '@prisma/client';
import type {
  CommunityBoardPostView,
  CommunityCommentView,
  CommunityFeedResponse,
  CommunityPostListResponse,
  CommunityReviewView,
  CommunityTrendingWorkView,
} from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CommunityCommentReadModel,
  CommunityFeedInput,
  CommunityListInput,
  CommunityPostReadModel,
  CommunityReviewReadModel,
} from './community-service-base';
import { CommunityServiceBase } from './community-service-base';

@Injectable()
export class CommunityQueryService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

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
    ].sort((left, right) =>
      this.compareFeedCandidates(left, right, input.sort),
    );

    const cursor = input.cursor ? this.decodeFeedCursor(input.cursor) : null;
    const remaining = cursor
      ? candidates.filter(
          (candidate) =>
            this.compareFeedCandidates(candidate, cursor, input.sort) > 0,
        )
      : candidates;
    const page = remaining.slice(0, input.limit);

    return {
      items: page.map(
        ({ createdAt, reactionCount: _reactionCount, ...item }) => ({
          ...item,
          createdAt: createdAt.toISOString(),
        }),
      ),
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
      {
        averageRating: number | null;
        discussionCount: number;
        reviewCount: number;
      }
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
          right[1].reviewCount +
          right[1].discussionCount -
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
      nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
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
        ...(targetType === 'post'
          ? { postId: targetId }
          : { reviewId: targetId }),
      },
      include: this.commentInclude(viewerUserId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
    return (rows as unknown as CommunityCommentReadModel[]).map((comment) =>
      this.toCommentView(comment, viewerUserId),
    );
  }
}
