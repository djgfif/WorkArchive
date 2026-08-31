import { Inject, Injectable } from '@nestjs/common';

import { CommunityService } from '../community.service';

@Injectable()
export class CommunityQueryService {
  constructor(
    @Inject(CommunityService)
    private readonly community: CommunityService,
  ) {}

  listPosts(...args: Parameters<CommunityService['listPosts']>) {
    return this.community.listPosts(...args);
  }

  listFeed(...args: Parameters<CommunityService['listFeed']>) {
    return this.community.listFeed(...args);
  }

  listTrendingWorks(
    ...args: Parameters<CommunityService['listTrendingWorks']>
  ) {
    return this.community.listTrendingWorks(...args);
  }

  getPost(...args: Parameters<CommunityService['getPost']>) {
    return this.community.getPost(...args);
  }

  listReviewsByWork(
    ...args: Parameters<CommunityService['listReviewsByWork']>
  ) {
    return this.community.listReviewsByWork(...args);
  }

  getReview(...args: Parameters<CommunityService['getReview']>) {
    return this.community.getReview(...args);
  }

  listComments(...args: Parameters<CommunityService['listComments']>) {
    return this.community.listComments(...args);
  }
}
