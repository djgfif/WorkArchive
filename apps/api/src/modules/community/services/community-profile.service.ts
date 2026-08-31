import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityPostStatus,
  CommunityPostSurface,
  CommunityProfileVisibility,
} from '@prisma/client';
import type {
  CommunityBoardPostView,
  CommunityProfileView,
  UpdateCommunityProfileRequest,
} from '@work-archive/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CommunityPostReadModel,
  CommunityReviewReadModel,
} from './community-service-base';
import { CommunityServiceBase } from './community-service-base';

@Injectable()
export class CommunityProfileService extends CommunityServiceBase {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
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
    const [
      recentPosts,
      recentReviews,
      favoriteWorks,
      followerCount,
      followingCount,
      follow,
    ] = await Promise.all([
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
      recentPosts: (recentPosts as CommunityPostReadModel[]).map(
        (post) => this.toPostView(post, viewerUserId) as CommunityBoardPostView,
      ),
      recentReviews: (recentReviews as CommunityReviewReadModel[]).map(
        (review) => this.toReviewView(review, viewerUserId),
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
    const favoriteIds = [...new Set(input.favoriteCatalogTitleIds)].slice(
      0,
      12,
    );
    if (favoriteIds.length) {
      const count = await this.prisma.catalogTitle.count({
        where: { id: { in: favoriteIds } },
      });
      if (count !== favoriteIds.length) {
        throw new BadRequestException(
          'One or more favorite works were not found.',
        );
      }
    }
    await this.prisma.userCommunityProfile.upsert({
      where: { userId },
      create: {
        allowFollowers: input.allowFollowers,
        bio: input.bio.trim(),
        favoriteCatalogTitleIds: favoriteIds,
        favoriteGenres: [
          ...new Set(
            input.favoriteGenres.map((genre) => genre.trim()).filter(Boolean),
          ),
        ].slice(0, 12),
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
        favoriteGenres: [
          ...new Set(
            input.favoriteGenres.map((genre) => genre.trim()).filter(Boolean),
          ),
        ].slice(0, 12),
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
}
