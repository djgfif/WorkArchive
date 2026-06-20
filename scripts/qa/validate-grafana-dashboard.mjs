#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const dashboardFile = resolve(
  rootDir,
  process.argv[2] ??
    'docs/operations/monitoring/work-archive-grafana-dashboard.json',
);
const text = readFileSync(dashboardFile, 'utf8');
const findings = [];

const expectedPanels = new Map([
  ['Readiness Failures', ['work_archive_readyz_failure_total']],
  ['API 5xx Rate', ['work_archive_api_request_total', 'status_class="5xx"']],
  [
    'API p95 Latency',
    [
      'work_archive_api_request_duration_seconds_bucket',
      'histogram_quantile(0.95',
      'sum by (le)',
    ],
  ],
  [
    'Import Circuit Opens',
    ['work_archive_imports_provider_circuit_open_total'],
  ],
  [
    'API Request Rate By Status Class',
    ['work_archive_api_request_total', 'sum by (status_class)'],
  ],
  [
    'API Latency',
    [
      'work_archive_api_request_duration_seconds_bucket',
      'histogram_quantile(0.95',
      'histogram_quantile(0.50',
      'sum by (le)',
    ],
  ],
  ['Auth Refresh Outcomes', ['work_archive_auth_refresh_total', 'sum by (result)']],
  [
    'Sync Push And Pull Outcomes',
    ['work_archive_sync_total', 'sum by (direction, result)'],
  ],
  [
    'Sync Conflicts By Entity And Code',
    ['work_archive_sync_conflict_total', 'sum by (entity_type, code)'],
  ],
  [
    'Sync Validation Failures By Entity And Code',
    [
      'work_archive_sync_failed_validation_total',
      'sum by (entity_type, code)',
    ],
  ],
  [
    'Import Provider Failures By Provider And Reason',
    [
      'work_archive_imports_provider_failure_total',
      'sum by (provider, reason)',
    ],
  ],
  [
    'Import Search Outcomes',
    [
      'work_archive_imports_search_total',
      'sum by (auth_scope, medium_type, provider_count, result)',
    ],
  ],
]);

const expectedMetrics = new Set([
  'work_archive_readyz_failure_total',
  'work_archive_api_request_total',
  'work_archive_api_request_duration_seconds_bucket',
  'work_archive_auth_refresh_total',
  'work_archive_sync_total',
  'work_archive_sync_conflict_total',
  'work_archive_sync_failed_validation_total',
  'work_archive_imports_provider_failure_total',
  'work_archive_imports_provider_circuit_open_total',
  'work_archive_imports_search_total',
]);

const allowedPanelTypes = new Set(['stat', 'table', 'timeseries']);
const sensitiveLabelNames = [
  'userId',
  'user_id',
  'email',
  'token',
  'cookie',
  'entityId',
  'entity_id',
  'requestId',
  'request_id',
  'path',
  'url',
  'route',
];

function fail(message) {
  findings.push(`${dashboardFile}: ${message}`);
}

function parseDashboard() {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
    return null;
  }
}

function flattenTargets(panels) {
  return panels.flatMap((panel) =>
    (panel.targets ?? []).map((target) => ({
      expr: target.expr ?? '',
      panel,
      target,
    })),
  );
}

function hasDatasourceVariable(dashboard) {
  return (dashboard.templating?.list ?? []).some(
    (template) =>
      template.name === 'datasource' &&
      template.type === 'datasource' &&
      template.query === 'prometheus',
  );
}

function datasourceUid(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value.uid;
}

function validateDatasource(panel, target) {
  const panelDatasourceUid = datasourceUid(panel.datasource);
  const targetDatasourceUid = datasourceUid(target.datasource);

  if (panelDatasourceUid !== '${datasource}') {
    fail(`${panel.title} must use the dashboard datasource variable.`);
  }
  if (targetDatasourceUid !== '${datasource}') {
    fail(`${panel.title} target ${target.refId ?? '?'} must use the dashboard datasource variable.`);
  }
}

function validatePromql(panel, target) {
  const expr = target.expr;

  if (!expr) {
    fail(`${panel.title} target ${target.refId ?? '?'} is missing expr.`);
    return;
  }

  for (const labelName of sensitiveLabelNames) {
    const filterPattern = new RegExp(`[,{]\\s*${labelName}\\s*=`);
    const groupingPattern = new RegExp(`by\\s*\\([^)]*\\b${labelName}\\b`);
    if (filterPattern.test(expr) || groupingPattern.test(expr)) {
      fail(`${panel.title} target ${target.refId ?? '?'} uses disallowed label "${labelName}".`);
    }
  }

  if (/work_archive_api_request_duration_seconds_bucket/.test(expr)) {
    if (!/sum by \(le\) \(rate\(work_archive_api_request_duration_seconds_bucket\[5m\]\)\)/.test(expr)) {
      fail(`${panel.title} must aggregate request latency histogram buckets by le.`);
    }
  }
}

const dashboard = parseDashboard();

if (dashboard) {
  if (!text.endsWith('\n')) {
    fail('file must end with a newline.');
  }
  if (dashboard.title !== 'Work Archive API Operations') {
    fail('dashboard title must be "Work Archive API Operations".');
  }
  if (dashboard.uid !== 'work-archive-api-operations') {
    fail('dashboard uid must be work-archive-api-operations.');
  }
  if (dashboard.editable !== false) {
    fail('dashboard must be non-editable in the repository artifact.');
  }
  if (!Array.isArray(dashboard.tags) || !dashboard.tags.includes('work-archive')) {
    fail('dashboard tags must include work-archive.');
  }
  if (!hasDatasourceVariable(dashboard)) {
    fail('dashboard must define a Prometheus datasource variable named datasource.');
  }
  if (!Array.isArray(dashboard.panels) || dashboard.panels.length === 0) {
    fail('dashboard must define panels.');
  }

  const panels = dashboard.panels ?? [];
  const panelTitles = new Set();
  const panelIds = new Set();

  for (const panel of panels) {
    if (!panel.title) {
      fail('panel is missing title.');
      continue;
    }
    if (panelTitles.has(panel.title)) {
      fail(`duplicate panel title "${panel.title}".`);
    }
    panelTitles.add(panel.title);

    if (!allowedPanelTypes.has(panel.type)) {
      fail(`${panel.title} uses unsupported panel type "${panel.type}".`);
    }
    if (typeof panel.id !== 'number') {
      fail(`${panel.title} must have a numeric panel id.`);
    } else if (panelIds.has(panel.id)) {
      fail(`${panel.title} reuses panel id ${panel.id}.`);
    } else {
      panelIds.add(panel.id);
    }
    if (!panel.gridPos || typeof panel.gridPos !== 'object') {
      fail(`${panel.title} must set gridPos for provisioned layout stability.`);
    }
    if (!Array.isArray(panel.targets) || panel.targets.length === 0) {
      fail(`${panel.title} must define at least one Prometheus target.`);
      continue;
    }
    for (const target of panel.targets) {
      validateDatasource(panel, target);
      validatePromql(panel, target);
    }
  }

  for (const [title, expectedFragments] of expectedPanels) {
    const panel = panels.find((candidate) => candidate.title === title);
    if (!panel) {
      fail(`missing expected panel "${title}".`);
      continue;
    }
    const panelQueryText = (panel.targets ?? [])
      .map((target) => target.expr ?? '')
      .join('\n');
    for (const fragment of expectedFragments) {
      if (!panelQueryText.includes(fragment)) {
        fail(`${title} is missing expected query fragment "${fragment}".`);
      }
    }
  }

  const allQueryText = flattenTargets(panels)
    .map(({ expr }) => expr)
    .join('\n');

  for (const metricName of expectedMetrics) {
    if (!allQueryText.includes(metricName)) {
      fail(`dashboard queries do not reference expected metric ${metricName}.`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(
  `Grafana dashboard passed local validation: ${dashboard.panels.length} panels`,
);
