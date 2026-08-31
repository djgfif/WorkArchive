export type DeploymentProfile = 'sites-guest-poc' | 'standard';

const DEFAULT_DEPLOYMENT_PROFILE: DeploymentProfile =
  import.meta.env.MODE === 'sites' ? 'sites-guest-poc' : 'standard';

export function getDeploymentProfile(
  configuredProfile: unknown =
    typeof window === 'undefined'
      ? undefined
      : window.__WORK_ARCHIVE_CONFIG__?.deploymentProfile,
): DeploymentProfile {
  return configuredProfile === 'sites-guest-poc'
    ? 'sites-guest-poc'
    : DEFAULT_DEPLOYMENT_PROFILE;
}

export const deploymentProfile = getDeploymentProfile();

export function isSitesGuestPoc() {
  return getDeploymentProfile() === 'sites-guest-poc';
}
