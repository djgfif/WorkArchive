import {
  getProductReleaseCapabilities,
  type ProductReleaseProfile,
} from '@work-archive/shared-types';
import {
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { readProductReleaseProfile } from '../../config/product-release-profile';

export type CommunityReleaseRequirement = 'reflection' | 'social';

const COMMUNITY_RELEASE_REQUIREMENT = 'communityReleaseRequirement';
export { readProductReleaseProfile } from '../../config/product-release-profile';

export function isCommunityReleaseEnabled(
  profile: ProductReleaseProfile,
  requirement: CommunityReleaseRequirement,
) {
  const capabilities = getProductReleaseCapabilities(profile);
  return requirement === 'reflection'
    ? capabilities.communityReflection
    : capabilities.communitySocial;
}

export const RequireCommunityRelease = (
  requirement: CommunityReleaseRequirement,
) => SetMetadata(COMMUNITY_RELEASE_REQUIREMENT, requirement);

@Injectable()
export class CommunityReleaseGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext) {
    const requirement = this.reflector.getAllAndOverride<
      CommunityReleaseRequirement | undefined
    >(COMMUNITY_RELEASE_REQUIREMENT, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      !requirement ||
      !isCommunityReleaseEnabled(readProductReleaseProfile(), requirement)
    ) {
      throw new NotFoundException();
    }

    return true;
  }
}
