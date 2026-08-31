import { Inject, Injectable } from '@nestjs/common';

import { CommunityQueryService } from './services/community-query.service';
import { CommunityPublicationService } from './services/community-publication.service';
import { CommunityInteractionService } from './services/community-interaction.service';
import { CommunityProfileService } from './services/community-profile.service';
import { CommunityDiscoveryService } from './services/community-discovery.service';
import { CommunityModerationService } from './services/community-moderation.service';

/** @deprecated Inject a role-specific Community service instead. */
@Injectable()
export class CommunityService {
  constructor(
    @Inject(CommunityQueryService)
    private readonly queries: CommunityQueryService,
    @Inject(CommunityPublicationService)
    private readonly publication: CommunityPublicationService,
    @Inject(CommunityInteractionService)
    private readonly interactions: CommunityInteractionService,
    @Inject(CommunityProfileService)
    private readonly profiles: CommunityProfileService,
    @Inject(CommunityDiscoveryService)
    private readonly discovery: CommunityDiscoveryService,
    @Inject(CommunityModerationService)
    private readonly moderation: CommunityModerationService,
  ) {}

  listPosts(...args: Parameters<CommunityQueryService['listPosts']>) {
    return this.queries.listPosts(...args);
  }

  getPost(...args: Parameters<CommunityQueryService['getPost']>) {
    return this.queries.getPost(...args);
  }

  listFeed(...args: Parameters<CommunityQueryService['listFeed']>) {
    return this.queries.listFeed(...args);
  }

  listTrendingWorks(
    ...args: Parameters<CommunityQueryService['listTrendingWorks']>
  ) {
    return this.queries.listTrendingWorks(...args);
  }

  listReviewsByWork(
    ...args: Parameters<CommunityQueryService['listReviewsByWork']>
  ) {
    return this.queries.listReviewsByWork(...args);
  }

  getReview(...args: Parameters<CommunityQueryService['getReview']>) {
    return this.queries.getReview(...args);
  }

  listComments(...args: Parameters<CommunityQueryService['listComments']>) {
    return this.queries.listComments(...args);
  }

  createPost(...args: Parameters<CommunityPublicationService['createPost']>) {
    return this.publication.createPost(...args);
  }

  deletePost(...args: Parameters<CommunityPublicationService['deletePost']>) {
    return this.publication.deletePost(...args);
  }

  upsertReview(
    ...args: Parameters<CommunityPublicationService['upsertReview']>
  ) {
    return this.publication.upsertReview(...args);
  }

  deleteReview(
    ...args: Parameters<CommunityPublicationService['deleteReview']>
  ) {
    return this.publication.deleteReview(...args);
  }

  createComment(
    ...args: Parameters<CommunityPublicationService['createComment']>
  ) {
    return this.publication.createComment(...args);
  }

  updateComment(
    ...args: Parameters<CommunityPublicationService['updateComment']>
  ) {
    return this.publication.updateComment(...args);
  }

  deleteComment(
    ...args: Parameters<CommunityPublicationService['deleteComment']>
  ) {
    return this.publication.deleteComment(...args);
  }

  setTargetReaction(
    ...args: Parameters<CommunityInteractionService['setTargetReaction']>
  ) {
    return this.interactions.setTargetReaction(...args);
  }

  setFollow(...args: Parameters<CommunityInteractionService['setFollow']>) {
    return this.interactions.setFollow(...args);
  }

  addReaction(...args: Parameters<CommunityInteractionService['addReaction']>) {
    return this.interactions.addReaction(...args);
  }

  removeReaction(
    ...args: Parameters<CommunityInteractionService['removeReaction']>
  ) {
    return this.interactions.removeReaction(...args);
  }

  getProfile(...args: Parameters<CommunityProfileService['getProfile']>) {
    return this.profiles.getProfile(...args);
  }

  updateProfile(...args: Parameters<CommunityProfileService['updateProfile']>) {
    return this.profiles.updateProfile(...args);
  }

  listTasteCandidates(
    ...args: Parameters<CommunityDiscoveryService['listTasteCandidates']>
  ) {
    return this.discovery.listTasteCandidates(...args);
  }

  listNotifications(
    ...args: Parameters<CommunityDiscoveryService['listNotifications']>
  ) {
    return this.discovery.listNotifications(...args);
  }

  markNotificationsRead(
    ...args: Parameters<CommunityDiscoveryService['markNotificationsRead']>
  ) {
    return this.discovery.markNotificationsRead(...args);
  }

  reportPost(...args: Parameters<CommunityModerationService['reportPost']>) {
    return this.moderation.reportPost(...args);
  }

  reportReview(
    ...args: Parameters<CommunityModerationService['reportReview']>
  ) {
    return this.moderation.reportReview(...args);
  }

  reportComment(
    ...args: Parameters<CommunityModerationService['reportComment']>
  ) {
    return this.moderation.reportComment(...args);
  }

  listReports(...args: Parameters<CommunityModerationService['listReports']>) {
    return this.moderation.listReports(...args);
  }

  hidePost(...args: Parameters<CommunityModerationService['hidePost']>) {
    return this.moderation.hidePost(...args);
  }

  hideReview(...args: Parameters<CommunityModerationService['hideReview']>) {
    return this.moderation.hideReview(...args);
  }

  hideComment(...args: Parameters<CommunityModerationService['hideComment']>) {
    return this.moderation.hideComment(...args);
  }

  restorePost(...args: Parameters<CommunityModerationService['restorePost']>) {
    return this.moderation.restorePost(...args);
  }

  restoreReview(
    ...args: Parameters<CommunityModerationService['restoreReview']>
  ) {
    return this.moderation.restoreReview(...args);
  }

  restoreComment(
    ...args: Parameters<CommunityModerationService['restoreComment']>
  ) {
    return this.moderation.restoreComment(...args);
  }

  resolveReport(
    ...args: Parameters<CommunityModerationService['resolveReport']>
  ) {
    return this.moderation.resolveReport(...args);
  }
}
