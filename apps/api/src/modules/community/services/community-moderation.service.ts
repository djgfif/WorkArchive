import { Inject, Injectable } from '@nestjs/common';

import { CommunityService } from '../community.service';

@Injectable()
export class CommunityModerationService {
  constructor(
    @Inject(CommunityService)
    private readonly community: CommunityService,
  ) {}

  reportPost(...args: Parameters<CommunityService['reportPost']>) {
    return this.community.reportPost(...args);
  }

  reportReview(...args: Parameters<CommunityService['reportReview']>) {
    return this.community.reportReview(...args);
  }

  reportComment(...args: Parameters<CommunityService['reportComment']>) {
    return this.community.reportComment(...args);
  }

  listReports(...args: Parameters<CommunityService['listReports']>) {
    return this.community.listReports(...args);
  }

  hidePost(...args: Parameters<CommunityService['hidePost']>) {
    return this.community.hidePost(...args);
  }

  restorePost(...args: Parameters<CommunityService['restorePost']>) {
    return this.community.restorePost(...args);
  }

  hideReview(...args: Parameters<CommunityService['hideReview']>) {
    return this.community.hideReview(...args);
  }

  restoreReview(...args: Parameters<CommunityService['restoreReview']>) {
    return this.community.restoreReview(...args);
  }

  hideComment(...args: Parameters<CommunityService['hideComment']>) {
    return this.community.hideComment(...args);
  }

  restoreComment(...args: Parameters<CommunityService['restoreComment']>) {
    return this.community.restoreComment(...args);
  }

  resolveReport(...args: Parameters<CommunityService['resolveReport']>) {
    return this.community.resolveReport(...args);
  }
}
