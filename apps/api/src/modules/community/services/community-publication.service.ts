import { Inject, Injectable } from '@nestjs/common';

import { CommunityService } from '../community.service';

@Injectable()
export class CommunityPublicationService {
  constructor(
    @Inject(CommunityService)
    private readonly community: CommunityService,
  ) {}

  createPost(...args: Parameters<CommunityService['createPost']>) {
    return this.community.createPost(...args);
  }

  deletePost(...args: Parameters<CommunityService['deletePost']>) {
    return this.community.deletePost(...args);
  }

  upsertReview(...args: Parameters<CommunityService['upsertReview']>) {
    return this.community.upsertReview(...args);
  }

  deleteReview(...args: Parameters<CommunityService['deleteReview']>) {
    return this.community.deleteReview(...args);
  }

  createComment(...args: Parameters<CommunityService['createComment']>) {
    return this.community.createComment(...args);
  }

  updateComment(...args: Parameters<CommunityService['updateComment']>) {
    return this.community.updateComment(...args);
  }

  deleteComment(...args: Parameters<CommunityService['deleteComment']>) {
    return this.community.deleteComment(...args);
  }
}
