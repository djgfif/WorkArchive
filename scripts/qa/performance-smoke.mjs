#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.PERF_SMOKE_REPORT_DIR ?? 'tmp/performance-smoke',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `performance-smoke-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `performance-smoke-${stamp}.json`);

const baseUrl = normalizeBaseUrl(
  process.env.PERF_SMOKE_BASE_URL ??
    process.env.BETA_BASE_URL ??
    'http://127.0.0.1:8080',
);
const allowedOrigin = normalizeBaseUrl(
  process.env.PERF_SMOKE_ALLOWED_ORIGIN ??
    process.env.SMOKE_ALLOWED_ORIGIN ??
    baseUrl,
);
const accessToken = process.env.PERF_SMOKE_ACCESS_TOKEN ?? '';
const dryRun = readBooleanEnv('PERF_SMOKE_DRY_RUN', false);
const requireAuthenticated =
  readBooleanEnv('PERF_SMOKE_REQUIRE_AUTHENTICATED', false);
const disposableAccountAck =
  readBooleanEnv('PERF_SMOKE_DISPOSABLE_ACCOUNT_ACK', false);
const iterations = readIntegerRangeEnv('PERF_SMOKE_ITERATIONS', 5, {
  max: 30,
  min: 1,
});
const syncRecordCount = readIntegerRangeEnv('PERF_SMOKE_SYNC_RECORDS', 3, {
  max: 25,
  min: 1,
});
const requestTimeoutMs = readIntegerRangeEnv('PERF_SMOKE_TIMEOUT_MS', 10000, {
  max: 60000,
  min: 1000,
});
const maxP50Ms = readOptionalIntegerRangeEnv('PERF_SMOKE_MAX_P50_MS', {
  max: 60000,
  min: 1,
});
const maxP95Ms = readOptionalIntegerRangeEnv('PERF_SMOKE_MAX_P95_MS', {
  max: 60000,
  min: 1,
});
const dryRunSampleMs = readOptionalIntegerRangeEnv('PERF_SMOKE_DRY_RUN_SAMPLE_MS', {
  max: 60000,
  min: 1,
});
const runId = sanitizeRunId(
  process.env.PERF_SMOKE_RUN_ID ?? `${stamp}-${randomUUID().slice(0, 8)}`,
);
const rateLimitHeaderNames = [
  'ratelimit',
  'ratelimit-policy',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
];
const sensitiveUrlParamPattern =
  /access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token/i;
const sensitiveInlineValuePattern =
  /\b((?:access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^\s&;,]+/gi;

function normalizeBaseUrl(value) {
  return String(value ?? '').replace(/\/$/, '');
}

function readBooleanEnv(name, fallback) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(`${name} must be true or false when set.`);
  }

  return rawValue === 'true';
}

function readIntegerRangeEnv(name, fallback, { min, max }) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsed = Number(rawValue);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer.`);
  }

  if (parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function readOptionalIntegerRangeEnv(name, { min, max }) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return null;
  }

  return readIntegerRangeEnv(name, 0, { max, min });
}

function sanitizeRunId(value) {
  return value.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 80);
}

function gitValue(args, fallback = 'unknown') {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() : fallback;
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : '[outside-workspace]';
}

function redact(value) {
  let text = String(value ?? '');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)=\S+/gi, '$1=[REDACTED]');
  text = text.replace(/(Cookie:\s*)[^\\n]+/gi, '$1[REDACTED]');
  text = text.replace(sensitiveInlineValuePattern, '$1[REDACTED]');
  if (accessToken) {
    text = text.split(accessToken).join('[REDACTED]');
  }
  return redactUrlSecrets(text);
}

function redactUrlSecrets(value) {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (match) => {
    try {
      const url = new URL(match);

      if (url.username) {
        url.username = 'redacted';
      }

      if (url.password) {
        url.password = 'redacted';
      }

      for (const key of [...url.searchParams.keys()]) {
        if (sensitiveUrlParamPattern.test(key)) {
          url.searchParams.set(key, '[REDACTED]');
        }
      }

      return url.toString();
    } catch {
      return match;
    }
  });
}

function urlFor(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function apiUrlFor(path) {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  const prefix = basePath.endsWith('/api') ? '' : '/api';
  base.pathname = `${basePath}${prefix}${path}`;
  return base.toString();
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function summarizeMeasurements(measurements) {
  const durations = measurements
    .filter((measurement) => Number.isFinite(measurement.durationMs))
    .map((measurement) => measurement.durationMs);
  const statuses = [...new Set(measurements.map((measurement) => measurement.status))];

  return {
    count: measurements.length,
    maxMs: durations.length ? Math.round(Math.max(...durations)) : null,
    minMs: durations.length ? Math.round(Math.min(...durations)) : null,
    p50Ms: durations.length ? Math.round(percentile(durations, 50)) : null,
    p95Ms: durations.length ? Math.round(percentile(durations, 95)) : null,
    rateLimitHeaders: summarizeRateLimitHeaders(measurements),
    statuses,
  };
}

function evaluateLatencyBudget(summary) {
  const budget = {};
  const violations = [];

  if (maxP50Ms !== null) {
    budget.maxP50Ms = maxP50Ms;
    if (summary.p50Ms === null) {
      violations.push('p50 not measured');
    } else if (summary.p50Ms > maxP50Ms) {
      violations.push(`p50 ${summary.p50Ms}ms > ${maxP50Ms}ms`);
    }
  }

  if (maxP95Ms !== null) {
    budget.maxP95Ms = maxP95Ms;
    if (summary.p95Ms === null) {
      violations.push('p95 not measured');
    } else if (summary.p95Ms > maxP95Ms) {
      violations.push(`p95 ${summary.p95Ms}ms > ${maxP95Ms}ms`);
    }
  }

  const configured = Object.keys(budget).length > 0;

  return {
    budget,
    status: configured ? (violations.length > 0 ? 'FAIL' : 'PASS') : 'NOT_CONFIGURED',
    violations,
  };
}

function summarizeRateLimitHeaders(measurements) {
  const observed = new Map();

  for (const measurement of measurements) {
    for (const [name, value] of Object.entries(measurement.rateLimitHeaders ?? {})) {
      observed.set(name, value);
    }
  }

  return Object.fromEntries([...observed.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  ));
}

function collectRateLimitHeaders(response) {
  if (!response) {
    return {};
  }

  const headers = {};

  for (const name of rateLimitHeaderNames) {
    const value = response.headers.get(name);

    if (value) {
      headers[name] = redact(value).slice(0, 200);
    }
  }

  return headers;
}

function formatRateLimitHeaders(headers) {
  const entries = Object.entries(headers ?? {});

  if (entries.length === 0) {
    return 'n/a';
  }

  return entries.map(([name, value]) => `${name}=${value}`).join('<br>');
}

async function request({ body, expectedStatuses, headers = {}, method, name, url }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();
  const requestHeaders = {
    ...headers,
  };
  let response;
  let text = '';
  let error = null;

  try {
    response = await fetch(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders,
      method,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : String(caughtError);
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = performance.now() - startedAt;
  const status = response?.status ?? 0;
  const ok = response ? expectedStatuses.includes(response.status) : false;

  return {
    durationMs,
    error: error ? redact(error) : null,
    name,
    ok,
    rateLimitHeaders: collectRateLimitHeaders(response),
    responseBytes: Buffer.byteLength(text, 'utf8'),
    status,
    textPreview: redact(text).slice(0, 1000),
  };
}

async function measureScenario(definition) {
  const measurements = [];

  for (let index = 0; index < iterations; index += 1) {
    measurements.push(await request(definition));
  }

  const summary = summarizeMeasurements(measurements);

  return {
    latencyBudget: evaluateLatencyBudget(summary),
    measurements,
    name: definition.name,
    required: definition.required,
    summary,
  };
}

function makeWorkPayload(index, nowIso) {
  const id = randomUUID();

  return {
    change: {
      queueId: randomUUID(),
      clientMutationId: randomUUID(),
      entityType: 'work',
      entityId: id,
      operation: 'create',
      createdAt: nowIso,
      payload: {
        id,
        type: 'novel',
        title: `Gate1 Perf Smoke ${runId} #${index + 1}`,
        author: 'Gate1 QA Synthetic',
        genres: [],
        personalTags: ['gate1-performance-smoke', runId],
        description: 'Synthetic record generated for Gate 1 performance smoke validation.',
        thumbnailUrl: '',
        status: 'planned',
        rating: null,
        shortReview: '',
        review: '',
        favorite: false,
        progressCurrent: null,
        progressTotal: null,
        progressUnit: null,
        lastConsumedLabel: null,
        startedAt: null,
        completedAt: null,
        droppedAt: null,
        lastConsumedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      },
    },
    id,
  };
}

async function runAuthenticatedSyncScenario() {
  if (!accessToken || !disposableAccountAck) {
    const summary = summarizeMeasurements([]);

    return {
      latencyBudget: evaluateLatencyBudget(summary),
      measurements: [],
      name: 'authenticated sync push/pull small batch',
      required: requireAuthenticated,
      skipped: true,
      skipReason: !accessToken
        ? 'PERF_SMOKE_ACCESS_TOKEN is not set.'
        : 'PERF_SMOKE_DISPOSABLE_ACCOUNT_ACK=true is required for live sync writes.',
      summary,
    };
  }

  const nowIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - 5000).toISOString();
  const fixtures = Array.from({ length: syncRecordCount }, (_, index) =>
    makeWorkPayload(index, nowIso),
  );
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Work-Archive-Client': 'web',
  };

  const measurements = [];
  measurements.push(
    await request({
      body: {
        schemaVersion: 5,
        changes: fixtures.map((fixture) => fixture.change),
      },
      expectedStatuses: [200],
      headers: authHeaders,
      method: 'POST',
      name: 'sync push small batch',
      url: apiUrlFor('/sync/push'),
    }),
  );
  measurements.push(
    await request({
      body: {
        schemaVersion: 5,
        limit: 100,
        since: sinceIso,
      },
      expectedStatuses: [200],
      headers: authHeaders,
      method: 'POST',
      name: 'sync pull small archive',
      url: apiUrlFor('/sync/pull'),
    }),
  );

  const summary = summarizeMeasurements(measurements);

  return {
    latencyBudget: evaluateLatencyBudget(summary),
    measurements,
    name: 'authenticated sync push/pull small batch',
    required: requireAuthenticated,
    summary,
  };
}

async function runLive() {
  const scenarios = [
    {
      expectedStatuses: [200, 503],
      method: 'GET',
      name: 'GET /readyz',
      required: true,
      url: urlFor('/readyz'),
    },
    {
      expectedStatuses: [204],
      headers: {
        Origin: allowedOrigin,
      },
      method: 'POST',
      name: 'POST /api/auth/refresh without cookie',
      required: true,
      url: apiUrlFor('/auth/refresh'),
    },
    {
      expectedStatuses: [200],
      method: 'GET',
      name: 'GET /api/imports/providers',
      required: true,
      url: apiUrlFor('/imports/providers'),
    },
    {
      expectedStatuses: [200],
      method: 'GET',
      name: 'GET /work-archive-config.js',
      required: true,
      url: urlFor('/work-archive-config.js'),
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await measureScenario(scenario));
  }
  results.push(await runAuthenticatedSyncScenario());

  return results;
}

function makeDryRunResults() {
  return [
    'GET /readyz',
    'POST /api/auth/refresh without cookie',
    'GET /api/imports/providers',
    'GET /work-archive-config.js',
    'authenticated sync push/pull small batch',
  ].map((name) => {
    const syntheticMeasurement =
      dryRunSampleMs === null
        ? []
        : [
            {
              durationMs: dryRunSampleMs,
              error: null,
              name,
              ok: true,
              rateLimitHeaders: {},
              responseBytes: 0,
              status: 200,
              textPreview: '',
            },
          ];
    const summary = summarizeMeasurements(syntheticMeasurement);

    return {
      latencyBudget: evaluateLatencyBudget(summary),
      measurements: syntheticMeasurement,
      name,
      required: name !== 'authenticated sync push/pull small batch' || requireAuthenticated,
      skipped: dryRunSampleMs === null,
      skipReason:
        dryRunSampleMs === null
          ? 'PERF_SMOKE_DRY_RUN=true generated report structure without HTTP calls.'
          : undefined,
      summary,
    };
  });
}

function deriveStatus(results) {
  const failedRequired = results.some(
    (result) =>
      result.required &&
      (!result.skipped || requireAuthenticated) &&
      result.measurements.some((measurement) => !measurement.ok),
  );
  const failedLatencyBudget = results.some(
    (result) =>
      result.required &&
      !result.skipped &&
      result.latencyBudget?.status === 'FAIL',
  );
  const blockedRequired = results.some(
    (result) => result.required && result.skipped && requireAuthenticated,
  );

  if (failedRequired || failedLatencyBudget) {
    return 'FAIL';
  }
  if (blockedRequired) {
    return 'BLOCKED';
  }
  if (results.some((result) => result.skipped)) {
    return 'PARTIAL';
  }
  return 'PASS';
}

function writeReports(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Performance Smoke Baseline',
    '',
    `- Timestamp UTC: ${report.timestamp}`,
    `- Git commit: ${report.gitCommit}`,
    `- Working tree: ${report.workingTree}`,
    `- Mode: ${report.mode}`,
    `- Status: ${report.status}`,
    `- Base URL: ${report.baseUrl}`,
    `- Iterations: ${report.iterations}`,
    `- Request timeout ms: ${report.requestTimeoutMs}`,
    `- Max p50 ms: ${report.latencyBudget.maxP50Ms ?? 'not configured'}`,
    `- Max p95 ms: ${report.latencyBudget.maxP95Ms ?? 'not configured'}`,
    `- Run ID: ${report.runId}`,
    '',
    '## Scenario Timings',
    '',
    '| Scenario | Status | Count | p50 ms | p95 ms | Budget | Status codes | RateLimit headers | Notes |',
    '| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
  ];

  for (const result of report.results) {
    const failed = result.measurements.filter((measurement) => !measurement.ok);
    const status = getScenarioStatus(report.mode, result, failed);
    const notes = result.skipped
      ? result.skipReason
      : failed.length > 0
        ? redact(failed.map((failure) => `${failure.status}:${failure.error ?? failure.textPreview}`).join('; '))
        : result.latencyBudget?.violations?.length
          ? result.latencyBudget.violations.join('; ')
        : '';

    lines.push(
      `| ${result.name} | ${status} | ${result.summary.count} | ${result.summary.p50Ms ?? 'n/a'} | ${result.summary.p95Ms ?? 'n/a'} | ${formatLatencyBudget(result.latencyBudget)} | ${result.summary.statuses.join(', ') || 'n/a'} | ${formatRateLimitHeaders(result.summary.rateLimitHeaders)} | ${notes || ''} |`,
    );
  }

  lines.push('');
  lines.push('## Safety Notes');
  lines.push('');
  lines.push('- Authenticated sync writes require `PERF_SMOKE_ACCESS_TOKEN` and `PERF_SMOKE_DISPOSABLE_ACCOUNT_ACK=true`.');
  lines.push('- Use only a disposable authenticated account for sync measurements.');
  lines.push('- Reports do not include bearer tokens, cookies, raw payloads, or response bodies beyond short redacted failure previews.');
  lines.push('- Standard `RateLimit-*`, `RateLimit`, and `Retry-After` headers are captured when present so release evidence includes the active limiter budget without storing request payloads.');
  lines.push('- Gate 1 p50/p95 values are release observations unless `PERF_SMOKE_MAX_P50_MS` or `PERF_SMOKE_MAX_P95_MS` is set for an approved release budget.');

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

function formatLatencyBudget(latencyBudget) {
  if (!latencyBudget || latencyBudget.status === 'NOT_CONFIGURED') {
    return 'not configured';
  }

  const limits = [
    latencyBudget.budget.maxP50Ms ? `p50<=${latencyBudget.budget.maxP50Ms}ms` : null,
    latencyBudget.budget.maxP95Ms ? `p95<=${latencyBudget.budget.maxP95Ms}ms` : null,
  ].filter(Boolean);

  return `${latencyBudget.status}: ${limits.join(', ')}`;
}

function getScenarioStatus(mode, result, failed) {
  if (mode === 'dry-run') {
    return result.latencyBudget?.status === 'FAIL' ? 'FAIL' : 'DRY-RUN';
  }
  if (result.skipped) {
    return result.required ? 'BLOCKED' : 'SKIPPED';
  }
  if (result.latencyBudget?.status === 'FAIL') {
    return 'FAIL';
  }
  return failed.length > 0 ? 'FAIL' : 'PASS';
}

const results = dryRun ? makeDryRunResults() : await runLive();
const report = {
  baseUrl: redact(baseUrl),
  gitCommit: gitValue(['rev-parse', 'HEAD']),
  iterations,
  jsonReportPath: relativePath(jsonReportPath),
  latencyBudget: {
    maxP50Ms,
    maxP95Ms,
  },
  mode: dryRun ? 'dry-run' : 'live',
  reportPath: relativePath(reportPath),
  requestTimeoutMs,
  results,
  runId,
  status: dryRun && dryRunSampleMs === null ? 'PASS' : deriveStatus(results),
  timestamp: new Date().toISOString(),
  workingTree: gitValue(['status', '--short']) ? 'dirty' : 'clean',
};

writeReports(report);
console.log(`Performance smoke report: ${relativePath(reportPath)}`);

if (report.status === 'FAIL' || report.status === 'BLOCKED') {
  process.exit(1);
}
