import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityBoardCategory,
  CommunityPostStatus,
  CommunityPostSurface,
} from '@prisma/client';
import type {
  CommunityCommentView,
  CommunityMutationResponse,
  CommunityPostView,
  CommunityReviewView,
  CreateCommunityCommentRequest,
  CreateCommunityPostRequest,
  UpdateCommunityCommentRequest,
  UpsertCommunityReviewRequest,
} from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CommunityCommentReadModel,
  CommunityPostReadModel,
  CommunityReviewReadModel,
} from './community-service-base';
import { CommunityServiceBase } from './community-service-base';

@Injectable()
export class CommunityPublicationService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
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
      throw new BadRequestException(
        'Short reflections cannot use board categories.',
      );
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

  async createComment(
    authorId: string,
    input: CreateCommunityCommentRequest,
  ): Promise<CommunityCommentView> {
    await this.assertCommunityIdentity(authorId);
    const target = await this.assertVisibleTarget(
      input.targetType,
      input.targetId,
    );
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
        throw new BadRequestException(
          'Replies may only target a top-level comment.',
        );
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
}
