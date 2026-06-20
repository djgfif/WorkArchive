#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.MONITORING_EVIDENCE_REPORT_DIR ?? 'tmp/monitoring-evidence',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `monitoring-evidence-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `monitoring-evidence-${stamp}.json`);

const prometheusUrl = normalizeBaseUrl(process.env.MONITORING_PROMETHEUS_URL ?? '');
const grafanaUrl = normalizeBaseUrl(process.env.MONITORING_GRAFANA_URL ?? '');
const publicBaseUrl = normalizeBaseUrl(process.env.MONITORING_PUBLIC_BASE_URL ?? '');
const internalMetricsUrl = process.env.MONITORING_INTERNAL_METRICS_URL ?? '';
const prometheusToken = process.env.MONITORING_PROMETHEUS_BEARER_TOKEN ?? '';
const grafanaToken = process.env.MONITORING_GRAFANA_BEARER_TOKEN ?? '';
const internalMetricsToken = process.env.MONITORING_INTERNAL_METRICS_BEARER_TOKEN ?? '';
const dryRun = process.env.MONITORING_EVIDENCE_DRY_RUN === 'true';
const requireGrafana = process.env.MONITORING_EVIDENCE_REQUIRE_GRAFANA === 'true';
const requireInternalMetrics =
  process.env.MONITORING_EVIDENCE_REQUIRE_INTERNAL_METRICS === 'true';
const requestTimeoutMs = clampInt(
  process.env.MONITORING_EVIDENCE_TIMEOUT_MS,
  10000,
  1000,
  60000,
);

const requiredAlertRules = [
  'WorkArchiveReadyzFailure',
  'WorkArchiveApi5xxSpike',
  'WorkArchiveHighRequestLatency',
  'WorkArchiveAuthRefreshFailureSpike',
  'WorkArchiveSyncConflictSpike',
  'WorkArchiveSyncValidationFailureSpike',
  'WorkArchiveImportProviderFailureSpike',
  'WorkArchiveImportProviderCircuitOpen',
];

const requiredSloRecords = [
  'work_archive:slo_api_availability:ratio_30d',
  'work_archive:slo_api_latency:p95_30d',
  'work_archive:slo_auth_refresh_success:ratio_30d',
  'work_archive:slo_sync_success:ratio_30d',
  'work_archive:slo_import_search_success:ratio_30d',
];

const requiredSloAlerts = [
  'WorkArchiveApiAvailabilitySloBurn',
  'WorkArchiveApiLatencySloBurn',
  'WorkArchiveAuthRefreshSloBurn',
  'WorkArchiveSyncSloBurn',
  'WorkArchiveImportSearchSloBurn',
];

const sloTargets = new Map([
  ['work_archive:slo_api_availability:ratio_30d', '0.995'],
  ['work_archive:slo_api_latency:p95_30d', '1'],
  ['work_archive:slo_auth_refresh_success:ratio_30d', '0.99'],
  ['work_archive:slo_sync_success:ratio_30d', '0.99'],
  ['work_archive:slo_import_search_success:ratio_30d', '0.95'],
]);

function normalizeBaseUrl(value) {
  return String(value ?? '').replace(/\/$/, '');
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
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

function redact(value) {
  let text = String(value ?? '');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)=\S+/gi, '$1=[REDACTED]');
  text = text.replace(/(Cookie:\s*)[^\n]+/gi, '$1[REDACTED]');
  for (const secret of [prometheusToken, grafanaToken, internalMetricsToken]) {
    if (secret) {
      text = text.split(secret).join('[REDACTED]');
    }
  }
  return text;
}

function makeUrl(baseUrl, path, searchParams = {}) {
  const url = new URL(path, `${baseUrl}/`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function requestJson({ baseUrl, name, path, searchParams, token }) {
  const response = await requestText({
    expectedStatuses: [200],
    name,
    token,
    url: makeUrl(baseUrl, path, searchParams),
  });
  let json = null;
  try {
    json = response.text ? JSON.parse(response.text) : null;
  } catch {
    response.ok = false;
    response.error = 'response was not valid JSON';
  }

  return {
    ...response,
    json,
  };
}

async function requestText({ expectedStatuses, name, token, url }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();
  const headers = {};
  let response;
  let text = '';
  let error = null;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    response = await fetch(url, {
      headers,
      method: 'GET',
      signal: controller.signal,
    });
    text = await response.text();
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : String(caughtError);
  } finally {
    clearTimeout(timeout);
  }

  const status = response?.status ?? 0;
  return {
    durationMs: Math.round(performance.now() - startedAt),
    error: error ? redact(error) : null,
    name,
    ok: response ? expectedStatuses.includes(response.status) : false,
    responseBytes: Buffer.byteLength(text, 'utf8'),
    status,
    text: redact(text).slice(0, 4000),
    url: redact(url),
  };
}

function flattenPrometheusRules(payload) {
  const groups = Array.isArray(payload?.data?.groups) ? payload.data.groups : [];
  return groups.flatMap((group) =>
    (group.rules ?? []).map((rule) => ({
      group: group.name ?? 'unknown',
      labels: rule.labels ?? {},
      name: rule.name ?? '',
      query: rule.query ?? '',
      state: rule.state ?? null,
      type: rule.type ?? 'unknown',
    })),
  );
}

function findRules(rules, names) {
  const available = new Map(rules.map((rule) => [rule.name, rule]));
  return names.map((name) => {
    const rule = available.get(name);
    return {
      group: rule?.group ?? null,
      name,
      present: Boolean(rule),
      state: rule?.state ?? null,
      type: rule?.type ?? null,
    };
  });
}

function summarizeSloQuery(name, response) {
  const result = response.json?.data?.result;
  const first = Array.isArray(result) ? result[0] : null;
  const value = Array.isArray(first?.value) ? first.value[1] : null;
  const numericValue = value === null ? null : Number(value);

  return {
    name,
    ok: response.ok && response.json?.status === 'success',
    sampleCount: Array.isArray(result) ? result.length : 0,
    target: sloTargets.get(name) ?? null,
    value: Number.isFinite(numericValue) ? numericValue : null,
  };
}

function renderCheckRows(checks) {
  return checks
    .map(
      (check) =>
        `| ${check.name} | ${check.status} | ${check.detail.replace(/\|/g, '\\|')} |`,
    )
    .join('\n');
}

function statusFromBoolean(value) {
  return value ? 'PASS' : 'FAIL';
}

async function collectLiveEvidence() {
  if (!prometheusUrl) {
    throw new Error('MONITORING_PROMETHEUS_URL is required unless MONITORING_EVIDENCE_DRY_RUN=true.');
  }

  const checks = [];
  const prometheusRulesResponse = await requestJson({
    baseUrl: prometheusUrl,
    name: 'prometheus rules',
    path: '/api/v1/rules',
    token: prometheusToken,
  });
  checks.push({
    detail: `HTTP ${prometheusRulesResponse.status}, ${prometheusRulesResponse.durationMs}ms`,
    name: 'Prometheus rules API',
    status: statusFromBoolean(prometheusRulesResponse.ok && prometheusRulesResponse.json?.status === 'success'),
  });

  const rules = flattenPrometheusRules(prometheusRulesResponse.json);
  const alertRules = findRules(rules, requiredAlertRules);
  const sloRecords = findRules(rules, requiredSloRecords);
  const sloAlerts = findRules(rules, requiredSloAlerts);

  for (const group of [
    ['Alert rules deployed', alertRules],
    ['SLO records deployed', sloRecords],
    ['SLO burn alerts deployed', sloAlerts],
  ]) {
    const missing = group[1].filter((rule) => !rule.present).map((rule) => rule.name);
    checks.push({
      detail: missing.length ? `missing: ${missing.join(', ')}` : `${group[1].length} expected rules found`,
      name: group[0],
      status: statusFromBoolean(missing.length === 0),
    });
  }

  const targetsResponse = await requestJson({
    baseUrl: prometheusUrl,
    name: 'prometheus active targets',
    path: '/api/v1/targets',
    searchParams: { state: 'active' },
    token: prometheusToken,
  });
  const activeTargets = Array.isArray(targetsResponse.json?.data?.activeTargets)
    ? targetsResponse.json.data.activeTargets
    : [];
  const workArchiveTargets = activeTargets.filter((target) => {
    const labels = target.labels ?? {};
    return (
      labels.service === 'work_archive_api' ||
      /work[-_ ]?archive/i.test(labels.job ?? '') ||
      /work[-_ ]?archive/i.test(target.scrapeUrl ?? '')
    );
  });
  checks.push({
    detail: `${workArchiveTargets.length} Work Archive-like target(s), ${activeTargets.length} active target(s) total`,
    name: 'Prometheus active Work Archive target',
    status: statusFromBoolean(targetsResponse.ok && workArchiveTargets.length > 0),
  });

  const sloQueries = [];
  for (const name of requiredSloRecords) {
    const response = await requestJson({
      baseUrl: prometheusUrl,
      name: `query ${name}`,
      path: '/api/v1/query',
      searchParams: { query: name },
      token: prometheusToken,
    });
    sloQueries.push(summarizeSloQuery(name, response));
  }
  const missingSloSamples = sloQueries
    .filter((query) => !query.ok || query.sampleCount === 0)
    .map((query) => query.name);
  checks.push({
    detail: missingSloSamples.length
      ? `missing samples: ${missingSloSamples.join(', ')}`
      : `${sloQueries.length} SLO records returned samples`,
    name: 'SLO query samples',
    status: statusFromBoolean(missingSloSamples.length === 0),
  });

  let grafanaDashboard = null;
  if (grafanaUrl) {
    const response = await requestJson({
      baseUrl: grafanaUrl,
      name: 'grafana dashboard',
      path: '/api/dashboards/uid/work-archive-api-operations',
      token: grafanaToken,
    });
    grafanaDashboard = {
      ok: response.ok,
      status: response.status,
      title: response.json?.dashboard?.title ?? null,
      uid: response.json?.dashboard?.uid ?? null,
      url: response.json?.meta?.url ?? null,
    };
    checks.push({
      detail: grafanaDashboard.ok
        ? `${grafanaDashboard.uid} ${grafanaDashboard.title}`
        : `HTTP ${response.status}`,
      name: 'Grafana dashboard imported',
      status: statusFromBoolean(
        grafanaDashboard.ok &&
          grafanaDashboard.uid === 'work-archive-api-operations',
      ),
    });
  } else {
    checks.push({
      detail: 'MONITORING_GRAFANA_URL is not set.',
      name: 'Grafana dashboard imported',
      status: requireGrafana ? 'FAIL' : 'SKIP',
    });
  }

  let publicMetrics = null;
  if (publicBaseUrl) {
    publicMetrics = await requestText({
      expectedStatuses: [404],
      name: 'public unauthenticated metrics',
      url: makeUrl(publicBaseUrl, '/metrics'),
    });
    checks.push({
      detail: `HTTP ${publicMetrics.status}`,
      name: 'Public unauthenticated /metrics hidden',
      status: statusFromBoolean(publicMetrics.ok),
    });
  }

  let internalMetrics = null;
  if (internalMetricsUrl) {
    internalMetrics = await requestText({
      expectedStatuses: [200],
      name: 'internal metrics collector path',
      token: internalMetricsToken,
      url: internalMetricsUrl,
    });
    checks.push({
      detail: `HTTP ${internalMetrics.status}, contains work_archive_api_request_total=${internalMetrics.text.includes('work_archive_api_request_total')}`,
      name: 'Internal collector /metrics reachable',
      status: statusFromBoolean(
        internalMetrics.ok &&
          internalMetrics.text.includes('work_archive_api_request_total'),
      ),
    });
  } else {
    checks.push({
      detail: 'MONITORING_INTERNAL_METRICS_URL is not set.',
      name: 'Internal collector /metrics reachable',
      status: requireInternalMetrics ? 'FAIL' : 'SKIP',
    });
  }

  return {
    alertRules,
    checks,
    grafanaDashboard,
    internalMetrics: internalMetrics
      ? {
          ok: internalMetrics.ok,
          responseBytes: internalMetrics.responseBytes,
          status: internalMetrics.status,
        }
      : null,
    prometheus: {
      activeTargetCount: activeTargets.length,
      ruleCount: rules.length,
      workArchiveTargetCount: workArchiveTargets.length,
    },
    publicMetrics: publicMetrics
      ? {
          ok: publicMetrics.ok,
          status: publicMetrics.status,
        }
      : null,
    sloAlerts,
    sloQueries,
    sloRecords,
  };
}

function collectDryRunEvidence() {
  const checks = [
    {
      detail: 'Dry-run only; no Prometheus, Grafana, or metrics endpoint was queried.',
      name: 'Monitoring evidence collection',
      status: 'DRY_RUN',
    },
  ];

  return {
    alertRules: requiredAlertRules.map((name) => ({ name, present: false })),
    checks,
    grafanaDashboard: null,
    internalMetrics: null,
    prometheus: {
      activeTargetCount: 0,
      ruleCount: 0,
      workArchiveTargetCount: 0,
    },
    publicMetrics: null,
    sloAlerts: requiredSloAlerts.map((name) => ({ name, present: false })),
    sloQueries: requiredSloRecords.map((name) => ({
      name,
      ok: false,
      sampleCount: 0,
      target: sloTargets.get(name) ?? null,
      value: null,
    })),
    sloRecords: requiredSloRecords.map((name) => ({ name, present: false })),
  };
}

function renderReport(evidence, status) {
  const lines = [
    '# Monitoring Evidence Report',
    '',
    `- Timestamp UTC: ${new Date().toISOString()}`,
    `- Git commit: ${gitValue(['rev-parse', 'HEAD'])}`,
    `- Working tree: ${gitValue(['status', '--short']) ? 'dirty' : 'clean'}`,
    `- Mode: ${dryRun ? 'dry-run' : 'live'}`,
    `- Status: ${status}`,
    `- Report path: ${relativePath(reportPath)}`,
    '',
    'This generated report contains only redacted monitoring deployment evidence. Do not paste bearer tokens, cookies, raw metrics payloads, or dashboard API responses into release docs.',
    '',
    '## Checks',
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    renderCheckRows(evidence.checks),
    '',
    '## SLO Samples',
    '',
    '| Record | Samples | Value | Target |',
    '| --- | ---: | ---: | --- |',
    ...evidence.sloQueries.map(
      (query) =>
        `| ${query.name} | ${query.sampleCount} | ${query.value ?? 'not observed'} | ${query.target ?? 'n/a'} |`,
    ),
    '',
    '## Prometheus Summary',
    '',
    `- Total rules observed: ${evidence.prometheus.ruleCount}`,
    `- Active targets observed: ${evidence.prometheus.activeTargetCount}`,
    `- Work Archive target candidates: ${evidence.prometheus.workArchiveTargetCount}`,
    '',
  ];

  if (evidence.grafanaDashboard) {
    lines.push('## Grafana Summary', '');
    lines.push(`- UID: ${evidence.grafanaDashboard.uid ?? 'not observed'}`);
    lines.push(`- Title: ${evidence.grafanaDashboard.title ?? 'not observed'}`);
    lines.push(`- HTTP status: ${evidence.grafanaDashboard.status}`);
    lines.push('');
  }

  return `${redact(lines.join('\n'))}\n`;
}

async function main() {
  mkdirSync(reportDir, { recursive: true });

  const evidence = dryRun ? collectDryRunEvidence() : await collectLiveEvidence();
  const hasFailures = evidence.checks.some((check) => check.status === 'FAIL');
  const status = hasFailures ? 'FAIL' : dryRun ? 'DRY_RUN' : 'PASS';
  const report = renderReport(evidence, status);

  writeFileSync(reportPath, report);
  writeFileSync(
    jsonReportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: dryRun ? 'dry-run' : 'live',
        status,
        ...evidence,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Monitoring evidence report: ${relativePath(reportPath)}`);

  if (hasFailures) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
