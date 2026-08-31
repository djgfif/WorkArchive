import type { ProductReleaseProfile } from '@work-archive/shared-types';

import {
  deploymentProfile,
  type DeploymentProfile,
} from '@shared/runtime/deployment-profile';
import { featureFlags, type FeatureFlags } from '@shared/runtime/feature-flags';
import {
  isCommunityReflectionEnabled,
  productReleaseProfile,
} from '@shared/runtime/product-release-profile';
import { appI18n } from '@app/i18n';

export function getPrimaryNavigationItems(
  flags: FeatureFlags = featureFlags,
  releaseProfile: ProductReleaseProfile = productReleaseProfile,
  profile: DeploymentProfile = deploymentProfile,
) {
  const communityEnabled =
    profile !== 'sites-guest-poc' &&
    isCommunityReflectionEnabled(releaseProfile);

  return [
    { label: appI18n.t('navigation.home'), to: '/' },
    { label: appI18n.t('navigation.works'), to: '/works' },
    ...(communityEnabled
      ? [{ label: appI18n.t('navigation.community'), to: '/community' }]
      : []),
    { label: appI18n.t('navigation.insights'), to: '/insights' },
    ...(flags.tierBoards
      ? [{ label: appI18n.t('navigation.tierBoards'), to: '/tier-boards' }]
      : []),
  ] as const;
}
