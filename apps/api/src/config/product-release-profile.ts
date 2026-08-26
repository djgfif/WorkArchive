import {
  getProductReleaseCapabilities,
  isProductReleaseProfile,
  type ProductReleaseProfile,
} from '@work-archive/shared-types';

export const DEFAULT_PRODUCT_RELEASE_PROFILE: ProductReleaseProfile =
  'personal-archive';

export function readProductReleaseProfile(
  configuredValue: unknown = process.env.PRODUCT_RELEASE_PROFILE,
): ProductReleaseProfile {
  if (
    configuredValue === undefined ||
    configuredValue === null ||
    configuredValue === ''
  ) {
    return DEFAULT_PRODUCT_RELEASE_PROFILE;
  }

  if (!isProductReleaseProfile(configuredValue)) {
    throw new Error(
      'PRODUCT_RELEASE_PROFILE must be personal-archive, community-reflection-alpha, or community-social-experiment.',
    );
  }

  return configuredValue;
}

export function getProductReleaseRuntime(
  configuredValue: unknown = process.env.PRODUCT_RELEASE_PROFILE,
) {
  const profile = readProductReleaseProfile(configuredValue);

  return {
    capabilities: getProductReleaseCapabilities(profile),
    profile,
  };
}
