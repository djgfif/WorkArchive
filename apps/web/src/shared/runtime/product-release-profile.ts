import {
  getProductReleaseCapabilities,
  isProductReleaseProfile,
  type ProductReleaseCapabilities,
  type ProductReleaseProfile,
} from '@work-archive/shared-types';

export const DEFAULT_PRODUCT_RELEASE_PROFILE: ProductReleaseProfile =
  'personal-archive';

export function resolveProductReleaseProfile(
  runtimeValue: unknown,
  environmentValue: unknown,
): ProductReleaseProfile {
  const configuredValue =
    runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== ''
      ? runtimeValue
      : environmentValue;

  if (configuredValue === undefined || configuredValue === null || configuredValue === '') {
    return DEFAULT_PRODUCT_RELEASE_PROFILE;
  }

  return isProductReleaseProfile(configuredValue)
    ? configuredValue
    : DEFAULT_PRODUCT_RELEASE_PROFILE;
}

function readRuntimeProfile() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.__WORK_ARCHIVE_CONFIG__?.productReleaseProfile;
}

export function getProductReleaseProfile(): ProductReleaseProfile {
  return resolveProductReleaseProfile(
    readRuntimeProfile(),
    import.meta.env.VITE_PRODUCT_RELEASE_PROFILE,
  );
}

export const productReleaseProfile = getProductReleaseProfile();

export function getReleaseCapabilities(
  profile: ProductReleaseProfile = productReleaseProfile,
): ProductReleaseCapabilities {
  return getProductReleaseCapabilities(profile);
}

export function isCommunityReflectionEnabled(
  profile: ProductReleaseProfile = productReleaseProfile,
) {
  return getReleaseCapabilities(profile).communityReflection;
}

export function isCommunitySocialEnabled(
  profile: ProductReleaseProfile = productReleaseProfile,
) {
  return getReleaseCapabilities(profile).communityCore;
}

export function isCommunityFullEnabled(
  profile: ProductReleaseProfile = productReleaseProfile,
) {
  return getReleaseCapabilities(profile).communityFull;
}
