import { afterEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from './feature-flags';

describe('feature flags', () => {
  afterEach(() => {
    delete window.__WORK_ARCHIVE_CONFIG__;
  });

  it('reads runtime overrides from the app config object', () => {
    window.__WORK_ARCHIVE_CONFIG__ = {
      featureFlags: {
        tierBoards: 'off',
      },
    };

    expect(getFeatureFlags().tierBoards).toBe(false);
  });
});
