import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

import { readApiRuntimeConfig } from '../config/api-runtime-config';

type RequestLabels = {
  method: string;
  route: string;
  status_class: string;
};

@Injectable()
export class MetricsService {
  private readonly config = readApiRuntimeConfig();
  private readonly enabled = this.config.metricsEnabled;
  private readonly registry = new Registry();
  private readonly requestCount: Counter<string>;
  private readonly requestDuration: Histogram<string>;
  private readonly authRefreshCount: Counter<string>;
  private readonly syncCount: Counter<string>;
  private readonly syncConflictCount: Counter<string>;
  private readonly syncFailedValidationCount: Counter<string>;
  private readonly importsProviderFailureCount: Counter<string>;
  private readonly importsProviderCircuitOpenCount: Counter<string>;
  private readonly readyzFailureCount: Counter<string>;

  constructor() {
    this.registry.setDefaultLabels({
      service: 'work_archive_api',
    });

    collectDefaultMetrics({
      prefix: 'work_archive_',
      register: this.registry,
    });

    this.requestCount = new Counter({
      help: 'API requests by method, normalized route, and status class.',
      labelNames: ['method', 'route', 'status_class'],
      name: 'work_archive_api_request_total',
      registers: [this.registry],
    });
    this.requestDuration = new Histogram({
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      help: 'API request duration in seconds.',
      labelNames: ['method', 'route', 'status_class'],
      name: 'work_archive_api_request_duration_seconds',
      registers: [this.registry],
    });
    this.authRefreshCount = new Counter({
      help: 'Auth refresh attempts by result.',
      labelNames: ['result', 'reason'],
      name: 'work_archive_auth_refresh_total',
      registers: [this.registry],
    });
    this.syncCount = new Counter({
      help: 'Sync push and pull calls by direction and result.',
      labelNames: ['direction', 'result'],
      name: 'work_archive_sync_total',
      registers: [this.registry],
    });
    this.syncConflictCount = new Counter({
      help: 'Sync conflicts by entity type and code.',
      labelNames: ['entity_type', 'code'],
      name: 'work_archive_sync_conflict_total',
      registers: [this.registry],
    });
    this.syncFailedValidationCount = new Counter({
      help: 'Sync validation failures by entity type and code.',
      labelNames: ['entity_type', 'code'],
      name: 'work_archive_sync_failed_validation_total',
      registers: [this.registry],
    });
    this.importsProviderFailureCount = new Counter({
      help: 'Import provider failures by provider and reason.',
      labelNames: ['provider', 'reason'],
      name: 'work_archive_imports_provider_failure_total',
      registers: [this.registry],
    });
    this.importsProviderCircuitOpenCount = new Counter({
      help: 'Import provider circuit openings by provider and reason.',
      labelNames: ['provider', 'reason'],
      name: 'work_archive_imports_provider_circuit_open_total',
      registers: [this.registry],
    });
    this.readyzFailureCount = new Counter({
      help: 'Readiness check failures by check name.',
      labelNames: ['check'],
      name: 'work_archive_readyz_failure_total',
      registers: [this.registry],
    });
  }

  isEnabled() {
    return this.enabled;
  }

  canReadMetrics(authorizationHeader: string | undefined) {
    if (!this.enabled) {
      return false;
    }

    if (!this.config.metricsBearerToken) {
      return !this.config.isProduction;
    }

    const prefix = 'Bearer ';

    if (!authorizationHeader?.startsWith(prefix)) {
      return false;
    }

    const token = authorizationHeader.slice(prefix.length);
    const expected = Buffer.from(this.config.metricsBearerToken);
    const actual = Buffer.from(token);

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  contentType() {
    return this.registry.contentType;
  }

  metrics() {
    return this.registry.metrics();
  }

  recordRequest(labels: RequestLabels, durationSeconds: number) {
    if (!this.enabled) {
      return;
    }

    this.requestCount.inc(labels);
    this.requestDuration.observe(labels, durationSeconds);
  }

  recordAuthRefresh(result: 'success' | 'failure', reason = 'ok') {
    if (this.enabled) {
      this.authRefreshCount.inc({ reason, result });
    }
  }

  recordSync(direction: 'push' | 'pull', result: 'success' | 'failure') {
    if (this.enabled) {
      this.syncCount.inc({ direction, result });
    }
  }

  recordSyncResult(entityType: string, status: string, code: string) {
    if (!this.enabled) {
      return;
    }

    const labels = {
      code: normalizeLabel(code),
      entity_type: normalizeLabel(entityType),
    };

    if (status === 'conflict') {
      this.syncConflictCount.inc(labels);
    }

    if (code === 'failed_validation') {
      this.syncFailedValidationCount.inc(labels);
    }
  }

  recordImportsProviderFailure(provider: string, reason: string) {
    if (this.enabled) {
      this.importsProviderFailureCount.inc({
        provider: normalizeLabel(provider),
        reason: normalizeLabel(reason),
      });
    }
  }

  recordImportsProviderCircuitOpen(provider: string, reason: string) {
    if (this.enabled) {
      this.importsProviderCircuitOpenCount.inc({
        provider: normalizeLabel(provider),
        reason: normalizeLabel(reason),
      });
    }
  }

  recordReadyzFailure(check: string) {
    if (this.enabled) {
      this.readyzFailureCount.inc({ check: normalizeLabel(check) });
    }
  }
}

export function normalizeMetricsRoute(value: string | undefined) {
  const route = value?.split('?')[0] || 'unknown';

  return route
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      '/:id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 160);
}

function normalizeLabel(value: string) {
  return value.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 80) || 'unknown';
}
