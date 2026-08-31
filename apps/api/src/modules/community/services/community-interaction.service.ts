import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityPostStatus, CommunityPostSurface } from '@prisma/client';
import type { CommunityMutationResponse } from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import { CommunityServiceBase } from './community-service-base';

@Injectable()
export class CommunityInteractionService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
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

  async setFollow(
    followerId: string,
    handle: string,
    following: boolean,
  ): Promise<CommunityMutationResponse> {
    await this.assertCommunityIdentity(followerId);
    const target = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        communityProfile: { select: { allowFollowers: true } },
        id: true,
      },
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
}
