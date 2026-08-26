import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCT_RELEASE_PROFILE,
  getReleaseCapabilities,
  resolveProductReleaseProfile,
} from './product-release-profile';

describe('product release profile', () => {
  it('defaults to the private personal archive profile', () => {
    expect(resolveProductReleaseProfile(undefined, undefined)).toBe(
      DEFAULT_PRODUCT_RELEASE_PROFILE,
    );
  });

  it('uses a valid runtime profile ahead of the build-time profile', () => {
    expect(
      resolveProductReleaseProfile(
        'community-reflection-alpha',
        'community-social-experiment',
      ),
    ).toBe('community-reflection-alpha');
  });

  it('fails closed when an explicit profile is invalid', () => {
    expect(
      resolveProductReleaseProfile(
        'commnunity-social-experiment',
        'community-social-experiment',
      ),
    ).toBe('personal-archive');
  });

  it('keeps reflection alpha separate from social capabilities', () => {
    expect(getReleaseCapabilities('community-reflection-alpha')).toEqual({
      communityReflection: true,
      communitySocial: false,
    });
  });

  it('enables both community surfaces only for the social experiment', () => {
    expect(getReleaseCapabilities('community-social-experiment')).toEqual({
      communityReflection: true,
      communitySocial: true,
    });
  });
});
