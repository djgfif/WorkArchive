import { Inject, Injectable } from '@nestjs/common';

import { CommunityService } from '../community.service';

@Injectable()
export class CommunityInteractionService {
  constructor(
    @Inject(CommunityService)
    private readonly community: CommunityService,
  ) {}

  setTargetReaction(
    ...args: Parameters<CommunityService['setTargetReaction']>
  ) {
    return this.community.setTargetReaction(...args);
  }

  addReaction(...args: Parameters<CommunityService['addReaction']>) {
    return this.community.addReaction(...args);
  }

  removeReaction(...args: Parameters<CommunityService['removeReaction']>) {
    return this.community.removeReaction(...args);
  }

  setFollow(...args: Parameters<CommunityService['setFollow']>) {
    return this.community.setFollow(...args);
  }

  listTasteCandidates(
    ...args: Parameters<CommunityService['listTasteCandidates']>
  ) {
    return this.community.listTasteCandidates(...args);
  }

  listNotifications(
    ...args: Parameters<CommunityService['listNotifications']>
  ) {
    return this.community.listNotifications(...args);
  }

  markNotificationsRead(
    ...args: Parameters<CommunityService['markNotificationsRead']>
  ) {
    return this.community.markNotificationsRead(...args);
  }
}
