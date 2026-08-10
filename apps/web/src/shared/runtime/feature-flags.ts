import type { DeploymentProfile } from './deployment-profile';

export type FeatureFlagKey =
  | 'diagnostics'
  | 'publicShare'
  | 'pwaInstall'
  | 'tierBoards';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

type FeatureFlagOverrides = Partial<Record<FeatureFlagKey, boolean | string | null | undefined>>;

declare global {
  interface Window {
    __WORK_ARCHIVE_CONFIG__?: {
      deploymentProfile?: DeploymentProfile;
      featureFlags?: FeatureFlagOverrides;
    };
  }
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  diagnostics: false,
  publicShare: false,
  pwaInstall: false,
  tierBoards: true,
};

const ENV_FLAG_KEYS: Record<FeatureFlagKey, string> = {
  diagnostics: 'VITE_FEATURE_DIAGNOSTICS',
  publicShare: 'VITE_FEATURE_PUBLIC_SHARE',
  pwaInstall: 'VITE_FEATURE_PWA_INSTALL',
  tierBoards: 'VITE_FEATURE_TIER_BOARDS',
};

function parseFlagOverride(value: boolean | string | null | undefined) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function readEnvFlag(key: FeatureFlagKey) {
  return parseFlagOverride(import.meta.env[ENV_FLAG_KEYS[key]]);
}

function readAppConfigFlag(key: FeatureFlagKey) {
  if (typeof window === 'undefined') {
    return null;
  }

  return parseFlagOverride(window.__WORK_ARCHIVE_CONFIG__?.featureFlags?.[key]);
}

export function getFeatureFlags(): FeatureFlags {
  return (Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]).reduce(
    (flags, key) => {
      flags[key] =
        readAppConfigFlag(key) ??
        readEnvFlag(key) ??
        DEFAULT_FEATURE_FLAGS[key];

      return flags;
    },
    { ...DEFAULT_FEATURE_FLAGS },
  );
}

export const featureFlags = getFeatureFlags();

export function isFeatureEnabled(key: FeatureFlagKey) {
  return featureFlags[key];
}
