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

  it('rejects malformed metrics bearer headers with extra segments', () => {
    resetEnv({
      METRICS_BEARER_TOKEN: 'collector-token-minimum-32-characters',
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    expect(
      service.canReadMetrics(
        'Bearer collector-token-minimum-32-characters extra',
      ),
    ).toBe(false);
    expect(
      service.canReadMetrics(
        'Bearer collector-token-minimum-32-characters\nX-Injected: value',
      ),
    ).toBe(false);
    expect(
      service.canReadMetrics('Bearer  collector-token-minimum-32-characters'),
    ).toBe(false);
  });

  it('records import search counters and duration labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordImportsSearch(
      {
        auth_scope: 'user',
        medium_type: 'novel',
        provider_count: '3',
        result: 'partial',
      },
      0.25,
    );

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_imports_search_total{auth_scope="user",medium_type="novel",provider_count="3",result="partial",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_imports_search_duration_seconds_count{service="work_archive_api",auth_scope="user",medium_type="novel",provider_count="3",result="partial"} 1',
    );
  });

  it('records import provider duration with bounded labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordImportsProviderDuration(
      {
        provider: 'open_library',
        result: 'success',
      },
      0.42,
    );

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_imports_provider_duration_seconds_count{service="work_archive_api",provider="open_library",result="success"} 1',
    );
    expect(metrics).not.toContain('userId');
  });

  it('records client header guard outcomes with bounded labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordClientHeaderGuard({
      method: 'POST',
      mode: 'audit',
      result: 'missing',
    });
    service.recordClientHeaderGuard({
      method: 'POST',
      mode: 'audit',
      result: 'accepted',
    });

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_client_header_guard_total{method="POST",mode="audit",result="missing",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_client_header_guard_total{method="POST",mode="audit",result="accepted",service="work_archive_api"} 1',
    );
    expect(metrics).not.toContain('path=');
    expect(metrics).not.toContain('userId');
  });

  it('records rate-limit rejections with bounded limiter labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordRateLimitExceeded('catalog');
    service.recordRateLimitExceeded('global');
    service.recordRateLimitExceeded('imports_authenticated');
    service.recordRateLimitExceeded('imports_protected');
    service.recordRateLimitExceeded('mutations');

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_rate_limit_exceeded_total{limiter="catalog",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_rate_limit_exceeded_total{limiter="global",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_rate_limit_exceeded_total{limiter="imports_authenticated",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_rate_limit_exceeded_total{limiter="imports_protected",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_rate_limit_exceeded_total{limiter="mutations",service="work_archive_api"} 1',
    );
    expect(metrics).not.toContain('ip=');
    expect(metrics).not.toContain('userId');
  });

  it('records sync duration with bounded labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordSyncDuration({ direction: 'push', result: 'success' }, 0.18);
    service.recordSyncDuration({ direction: 'pull', result: 'failure' }, 1.25);

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_sync_duration_seconds_count{service="work_archive_api",direction="push",result="success"} 1',
    );
    expect(metrics).toContain(
      'work_archive_sync_duration_seconds_count{service="work_archive_api",direction="pull",result="failure"} 1',
    );
    expect(metrics).not.toContain('userId');
    expect(metrics).not.toContain('route=');
  });

  it('records user data rights outcomes with bounded operation labels', async () => {
    resetEnv({
      METRICS_ENABLED: 'true',
    });

    const service = new MetricsService();

    service.recordUserDataRights({
      operation: 'export',
      result: 'success',
    });
    service.recordUserDataRights({
      operation: 'delete',
      result: 'failure',
    });

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'work_archive_user_data_rights_total{operation="export",result="success",service="work_archive_api"} 1',
    );
    expect(metrics).toContain(
      'work_archive_user_data_rights_total{operation="delete",result="failure",service="work_archive_api"} 1',
    );
    expect(metrics).not.toContain('userId');
    expect(metrics).not.toContain('email=');
    expect(metrics).not.toContain('route=');
    expect(metrics).not.toContain('path=');
  });
});
