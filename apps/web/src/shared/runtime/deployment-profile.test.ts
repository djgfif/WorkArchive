import { afterEach, describe, expect, it } from 'vitest';

import {
  getDeploymentProfile,
  isSitesGuestPoc,
} from './deployment-profile';

describe('deployment profile', () => {
  afterEach(() => {
    delete window.__WORK_ARCHIVE_CONFIG__;
  });

  it('uses the standard profile by default outside the Sites build', () => {
    expect(getDeploymentProfile()).toBe('standard');
  });

  it('accepts only the Sites guest POC runtime override', () => {
    expect(getDeploymentProfile('sites-guest-poc')).toBe('sites-guest-poc');
    expect(getDeploymentProfile('production')).toBe('standard');
  });

  it('reads the Sites guest POC profile from runtime config', () => {
    window.__WORK_ARCHIVE_CONFIG__ = {
      deploymentProfile: 'sites-guest-poc',
    };

    expect(isSitesGuestPoc()).toBe(true);
  });
});
