#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.SYNC_LOAD_REPORT_DIR ?? 'tmp/sync-load',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `sync-load-smoke-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `sync-load-smoke-${stamp}.json`);

const baseUrl = process.env.SYNC_LOAD_BASE_URL ?? 'http://127.0.0.1:8080';
const accessToken = process.env.SYNC_LOAD_ACCESS_TOKEN ?? '';
const recordCount = positiveInt(process.env.SYNC_LOAD_RECORDS, 1000);
const batchSize = Math.min(positiveInt(process.env.SYNC_LOAD_BATCH_SIZE, 200), 200);
const pullLimit = positiveInt(process.env.SYNC_LOAD_PULL_LIMIT, 500);
const runId = sanitizeRunId(
  process.env.SYNC_LOAD_RUN_ID ?? `${stamp}-${randomUUID().slice(0, 8)}`,
);
const dryRun =
  process.env.SYNC_LOAD_DRY_RUN === 'true' ||
  (!accessToken && process.env.SYNC_LOAD_DRY_RUN !== 'false');
const disposableAccountAck =
  process.env.SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK === 'true';

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeRunId(value) {
  return value.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 80);
}

function redact(value) {
  let text = String(value ?? '');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)=\S+/gi, '$1=[REDACTED]');
  if (accessToken) {
    text = text.split(accessToken).join('[REDACTED]');
  }
  return text;
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : '[outside-workspace]';
}

function gitValue(args, fallback = 'unknown') {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() : fallback;
}

function apiUrl(path) {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, '');
  const prefix = basePath.endsWith('/api') ? '' : '/api';
  url.pathname = `${basePath}${prefix}${path}`;
  return url;
}

function makeWorkPayload(index, nowIso) {
  const id = randomUUID();
  const title = `Gate1 Sync Load QA ${runId} #${String(index + 1).padStart(5, '0')}`;

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
        title,
        author: 'Gate1 QA Synthetic',
        genres: [],
        personalTags: ['gate1-sync-load-qa', runId],
        description: 'Synthetic record generated for Gate 1 sync load validation.',
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
    title,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

async function postJson(path, body) {
  const startedAt = performance.now();
  const response = await fetch(apiUrl(path), {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Work-Archive-Client': 'web',
    },
    method: 'POST',
  });
  const text = await response.text();
  const durationMs = performance.now() - startedAt;
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    body: json,
    durationMs,
    ok: response.ok,
    responseBytes: Buffer.byteLength(text, 'utf8'),
    status: response.status,
    text: redact(text).slice(0, 4000),
  };
}

async function runLive(fixtures, sinceIso) {
  const requestDurations = [];
  const responseSizes = [];
  const failures = [];
  const conflicts = [];
  const pushedIds = new Set(fixtures.map((fixture) => fixture.id));
  const observedIds = new Set();
  const duplicateIds = new Set();
  let pushBatchCount = 0;
  let pullPageCount = 0;
  let cursor = null;
  let hasMore = true;
  let lastCursor = null;
  const startedAt = performance.now();

  for (const batch of chunk(fixtures, batchSize)) {
    pushBatchCount += 1;
    const response = await postJson('/sync/push', {
      schemaVersion: 5,
      changes: batch.map((fixture) => fixture.change),
    });
    requestDurations.push(response.durationMs);
    responseSizes.push(response.responseBytes);

    if (!response.ok) {
      failures.push({
        batch: pushBatchCount,
        status: response.status,
        message: response.text,
      });
      continue;
    }

    for (const result of response.body?.results ?? []) {
      if (result.status === 'conflict') {
        conflicts.push({
          code: result.code ?? 'unknown',
          entityId: pushedIds.has(result.entityId) ? result.entityId : '[non-synthetic]',
        });
      } else if (result.status !== 'applied') {
        failures.push({
          batch: pushBatchCount,
          code: result.code ?? 'unknown',
          entityId: pushedIds.has(result.entityId) ? result.entityId : '[non-synthetic]',
          status: result.status ?? 'unknown',
        });
      }
    }
  }

  while (hasMore && pullPageCount < Math.ceil(recordCount / Math.min(pullLimit, 1000)) + 10) {
    pullPageCount += 1;
    const body = {
      schemaVersion: 5,
      since: sinceIso,
      limit: pullLimit,
      ...(cursor ? { cursor } : {}),
    };
    const response = await postJson('/sync/pull', body);
    requestDurations.push(response.durationMs);
    responseSizes.push(response.responseBytes);

    if (!response.ok) {
      failures.push({
        page: pullPageCount,
        status: response.status,
        message: response.text,
      });
      break;
    }

    const changes = Array.isArray(response.body?.changes) ? response.body.changes : [];
    for (const change of changes) {
      if (!pushedIds.has(change.entityId)) {
        continue;
      }

      if (observedIds.has(change.entityId)) {
        duplicateIds.add(change.entityId);
      }
      observedIds.add(change.entityId);
    }

    hasMore = Boolean(response.body?.hasMore);
    cursor = response.body?.nextCursor ?? null;
    if (hasMore && !cursor) {
      failures.push({
        page: pullPageCount,
        status: 'cursor_missing',
        message: 'hasMore=true but nextCursor was empty.',
      });
      break;
    }
    if (cursor && cursor === lastCursor) {
      failures.push({
        page: pullPageCount,
        status: 'cursor_repeated',
        message: 'nextCursor did not advance.',
      });
      break;
    }
    lastCursor = cursor;
  }

  const missingIds = [...pushedIds].filter((id) => !observedIds.has(id));
  if (missingIds.length > 0) {
    failures.push({
      count: missingIds.length,
      status: 'missing_synthetic_records',
      message: `${missingIds.length} synthetic ids were not observed in bounded pull.`,
    });
  }
  if (duplicateIds.size > 0) {
    failures.push({
      count: duplicateIds.size,
      status: 'duplicate_synthetic_records',
      message: `${duplicateIds.size} synthetic ids appeared more than once across pull pages.`,
    });
  }

  const defaultLimitSmoke = await postJson('/sync/pull', {
    schemaVersion: 5,
    since: sinceIso,
  });
  requestDurations.push(defaultLimitSmoke.durationMs);
  responseSizes.push(defaultLimitSmoke.responseBytes);

  const maxLimitSmoke = await postJson('/sync/pull', {
    schemaVersion: 5,
    since: sinceIso,
    limit: 1500,
  });
  requestDurations.push(maxLimitSmoke.durationMs);
  responseSizes.push(maxLimitSmoke.responseBytes);

  if (!defaultLimitSmoke.ok) {
    failures.push({
      status: 'default_limit_smoke_failed',
      message: defaultLimitSmoke.text,
    });
  }
  if (!maxLimitSmoke.ok) {
    if (maxLimitSmoke.status !== 400) {
      failures.push({
        status: 'max_limit_smoke_failed',
        message: maxLimitSmoke.text,
      });
    }
  }

  return {
    conflicts,
    duplicateCount: duplicateIds.size,
    failures,
    maxResponseBytes: Math.max(0, ...responseSizes),
    missingCount: missingIds.length,
    observedSyntheticCount: observedIds.size,
    pullPageCount,
    pushBatchCount,
    requestP50Ms: Math.round(percentile(requestDurations, 50) ?? 0),
    requestP95Ms: Math.round(percentile(requestDurations, 95) ?? 0),
    maxLimitSmokeStatus: maxLimitSmoke.status,
    status: failures.length === 0 && conflicts.length === 0 ? 'PASS' : 'FAIL',
    totalDurationMs: Math.round(performance.now() - startedAt),
  };
}

function writeReports(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Sync Load Smoke Report',
    '',
    `- Timestamp UTC: ${report.timestamp}`,
    `- Git commit: ${report.gitCommit}`,
    `- Working tree: ${report.workingTree}`,
    `- Mode: ${report.mode}`,
    `- Status: ${report.status}`,
    `- Run ID: ${report.runId}`,
    `- Synthetic records: ${report.recordCount}`,
    `- Batch size: ${report.batchSize}`,
    `- Pull limit: ${report.pullLimit}`,
    '',
    '## Result',
    '',
    `- Push batches: ${report.metrics.pushBatchCount}`,
    `- Pull pages: ${report.metrics.pullPageCount}`,
    `- Observed synthetic records: ${report.metrics.observedSyntheticCount}`,
    `- Missing synthetic records: ${report.metrics.missingCount}`,
    `- Duplicate synthetic records: ${report.metrics.duplicateCount}`,
    `- Total duration ms: ${report.metrics.totalDurationMs}`,
    `- Request p50 ms: ${report.metrics.requestP50Ms}`,
    `- Request p95 ms: ${report.metrics.requestP95Ms}`,
    `- Max response bytes: ${report.metrics.maxResponseBytes}`,
    `- Limit 1500 smoke HTTP status: ${report.metrics.maxLimitSmokeStatus}`,
    `- Conflicts: ${report.metrics.conflicts.length}`,
    `- Failures: ${report.metrics.failures.length}`,
    '',
  ];

  if (report.mode === 'dry-run') {
    lines.push('Dry-run generated synthetic payloads only. No API calls were made.');
    lines.push('');
  }

  if (report.metrics.failures.length > 0) {
    lines.push('## Failures', '');
    for (const failure of report.metrics.failures) {
      lines.push(`- ${redact(JSON.stringify(failure))}`);
    }
    lines.push('');
  }

  lines.push('## Safety Notes', '');
  lines.push('- Payload titles are synthetic and prefixed with `Gate1 Sync Load QA`.');
  lines.push('- Live mode requires `SYNC_LOAD_ACCESS_TOKEN` and `SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true`.');
  lines.push('- Reports do not include raw sync payloads or bearer tokens.');
  lines.push('- PASS requires zero failures, zero conflicts, zero missing synthetic records, and zero duplicate synthetic records.');
  lines.push('- Limit > 1000 smoke accepts either bounded HTTP 200 behavior or HTTP 400 DTO validation rejection.');
  lines.push('- Use a disposable authenticated test account; do not run this against a real user account.');

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

const nowIso = new Date().toISOString();
const sinceIso = new Date(Date.now() - 5000).toISOString();
const fixtures = Array.from({ length: recordCount }, (_, index) =>
  makeWorkPayload(index, nowIso),
);

const report = {
  batchSize,
  gitCommit: gitValue(['rev-parse', 'HEAD']),
  mode: dryRun ? 'dry-run' : 'live',
  pullLimit,
  recordCount,
  runId,
  status: 'PASS',
  timestamp: new Date().toISOString(),
  workingTree: gitValue(['status', '--short']) ? 'dirty' : 'clean',
  metrics: {
    conflicts: [],
    duplicateCount: 0,
    failures: [],
    maxResponseBytes: 0,
    missingCount: 0,
    observedSyntheticCount: 0,
    pullPageCount: 0,
    pushBatchCount: Math.ceil(recordCount / batchSize),
    requestP50Ms: 0,
    requestP95Ms: 0,
    maxLimitSmokeStatus: 0,
    totalDurationMs: 0,
  },
};

if (dryRun) {
  report.metrics.observedSyntheticCount = 0;
  report.metrics.totalDurationMs = 0;
} else if (!accessToken) {
  report.status = 'BLOCKED';
  report.metrics.failures.push({
    status: 'blocked_missing_access_token',
    message: 'SYNC_LOAD_ACCESS_TOKEN is required for live sync load validation.',
  });
} else if (!disposableAccountAck) {
  report.status = 'BLOCKED';
  report.metrics.failures.push({
    status: 'blocked_missing_disposable_account_ack',
    message:
      'Set SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true only for a disposable authenticated test account.',
  });
} else {
  report.metrics = await runLive(fixtures, sinceIso);
  report.status = report.metrics.status;
}

writeReports(report);
console.log(`Sync load smoke report: ${relativePath(reportPath)}`);

if (report.status !== 'PASS') {
  process.exit(1);
}
