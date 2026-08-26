import { describe, expect, it } from '@jest/globals';

import {
  getProductReleaseRuntime,
  readProductReleaseProfile,
} from '../src/config/product-release-profile';
import { ProductReleaseController } from '../src/modules/product-release/product-release.controller';

describe('product release runtime', () => {
  it('fails closed when no profile is configured', () => {
    expect(readProductReleaseProfile(undefined)).toBe('personal-archive');
    expect(getProductReleaseRuntime(undefined)).toEqual({
      capabilities: {
        communityReflection: false,
        communitySocial: false,
      },
      profile: 'personal-archive',
    });
  });

  it('exposes the exact capabilities for every allowed profile', () => {
    expect(getProductReleaseRuntime('community-reflection-alpha')).toEqual({
      capabilities: {
        communityReflection: true,
        communitySocial: false,
      },
      profile: 'community-reflection-alpha',
    });
    expect(getProductReleaseRuntime('community-social-experiment')).toEqual({
      capabilities: {
        communityReflection: true,
        communitySocial: true,
      },
      profile: 'community-social-experiment',
    });
  });

  it('rejects an invalid explicit profile', () => {
    expect(() => getProductReleaseRuntime('community-typo')).toThrow(
      /PRODUCT_RELEASE_PROFILE/,
    );
  });

  it('serves the active profile through the public controller', () => {
    const previous = process.env.PRODUCT_RELEASE_PROFILE;
    process.env.PRODUCT_RELEASE_PROFILE = 'community-reflection-alpha';
    try {
      expect(new ProductReleaseController().getProductRelease().profile).toBe(
        'community-reflection-alpha',
      );
    } finally {
      if (previous === undefined) delete process.env.PRODUCT_RELEASE_PROFILE;
      else process.env.PRODUCT_RELEASE_PROFILE = previous;
    }
  });
});
