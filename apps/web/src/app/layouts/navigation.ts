import {
  featureFlags,
  type FeatureFlags,
} from '@shared/runtime/feature-flags';

export function getPrimaryNavigationItems(flags: FeatureFlags = featureFlags) {
  return [
    { label: '홈', to: '/' },
    { label: '작품', to: '/works' },
    ...(flags.tierBoards ? [{ label: '티어보드', to: '/tier-boards' }] : []),
  ] as const;
}
