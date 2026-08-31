import { Inject, Injectable } from '@nestjs/common';
import {
  CommunityPostStatus,
  CommunityProfileVisibility,
  type WorkType,
} from '@prisma/client';
import type {
  CommunityMutationResponse,
  CommunityTasteCandidate,
} from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  CommunityServiceBase,
  PUBLIC_AUTHOR_SELECT,
} from './community-service-base';

@Injectable()
export class CommunityDiscoveryService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  async listTasteCandidates(
    viewerUserId: string,
  ): Promise<CommunityTasteCandidate[]> {
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
        if (review.rating !== null)
          catalogRatings[review.catalogTitleId] = review.rating;
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

  async markNotificationsRead(
    userId: string,
  ): Promise<CommunityMutationResponse> {
    await this.prisma.communityNotification.updateMany({
      where: { readAt: null, recipientId: userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
