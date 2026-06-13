import {
  featureFlags,
  type FeatureFlags,
} from '@shared/runtime/feature-flags';
import { appI18n } from '@app/i18n';

export function getPrimaryNavigationItems(flags: FeatureFlags = featureFlags) {
  return [
    { label: appI18n.t('navigation.home'), to: '/' },
    { label: appI18n.t('navigation.works'), to: '/works' },
    { label: appI18n.t('navigation.insights'), to: '/insights' },
    ...(flags.tierBoards
      ? [{ label: appI18n.t('navigation.tierBoards'), to: '/tier-boards' }]
      : []),
  ] as const;
}
