import { Inject, Injectable } from '@nestjs/common';

import { CommunityService } from '../community.service';

@Injectable()
export class CommunityProfileService {
  constructor(
    @Inject(CommunityService)
    private readonly community: CommunityService,
  ) {}

  getProfile(...args: Parameters<CommunityService['getProfile']>) {
    return this.community.getProfile(...args);
  }

  updateProfile(...args: Parameters<CommunityService['updateProfile']>) {
    return this.community.updateProfile(...args);
  }
}
