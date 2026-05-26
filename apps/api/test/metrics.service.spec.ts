import { afterEach, describe, expect, it } from '@jest/globals';

import { MetricsService } from '../src/observability/metrics.service';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    DATABASE_URL: 'postgresql://work:archive@localhost:5432/work_archive',
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    NODE_ENV: 'test',
    RATE_LIMIT_STORE: 'memory',
    SECURITY_EVENT_HASH_SECRET: 'test-security-event-hash-secret',
    ...overrides,
  };
}

describe('MetricsService', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not allow reads when metrics are disabled', () => {
    resetEnv({
      METRICS_ENABLED: 'false',
    });

    expect(new MetricsService().canReadMetrics('Bearer collector-token')).toBe(
      false,
    );
  });

  it('hides enabled metrics when the bearer token is missing or invalid', () => {
    resetEnv({
      METRICS_BEARER_TOKEN: 'collector-token-minimum-32-characters',
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    expect(service.canReadMetrics(undefined)).toBe(false);
    expect(service.canReadMetrics('Bearer wrong-token-minimum-32-chars')).toBe(
      false,
    );
  });

  it('allows enabled metrics with the configured collector bearer token', () => {
    resetEnv({
      METRICS_BEARER_TOKEN: 'collector-token-minimum-32-characters',
      METRICS_ENABLED: 'true',
    });

    expect(
      new MetricsService().canReadMetrics(
        'Bearer collector-token-minimum-32-characters',
      ),
    ).toBe(true);
  });

  it('does not throw when the presented bearer token has the wrong length', () => {
    resetEnv({
      METRICS_BEARER_TOKEN: 'collector-token-minimum-32-characters',
      METRICS_ENABLED: 'true',
    });

    expect(() =>
      new MetricsService().canReadMetrics('Bearer short'),
    ).not.toThrow();
    expect(new MetricsService().canReadMetrics('Bearer short')).toBe(false);
  });
});
