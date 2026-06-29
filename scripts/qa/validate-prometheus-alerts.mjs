#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const alertFile = resolve(
  rootDir,
  process.argv[2] ?? 'docs/operations/monitoring/work-archive-alerts.yml',
);
const text = readFileSync(alertFile, 'utf8');
const lines = text.split(/\r?\n/);
const findings = [];
const rules = [];
let currentRule = null;
let currentSection = null;

const allowedRuleLabels = new Set(['severity', 'service']);
const requiredAlerts = new Set([
  'WorkArchiveReadyzFailure',
  'WorkArchiveApi5xxSpike',
  'WorkArchiveHighRequestLatency',
  'WorkArchiveAuthRefreshFailureSpike',
  'WorkArchiveUserDataRightsFailureSpike',
  'WorkArchiveRateLimitRejectionSpike',
  'WorkArchiveClientHeaderGuardMissingSpike',
  'WorkArchiveSyncConflictSpike',
  'WorkArchiveSyncValidationFailureSpike',
  'WorkArchiveSyncHighLatency',
  'WorkArchiveImportProviderFailureSpike',
  'WorkArchiveImportProviderCircuitOpen',
  'WorkArchiveImportProviderHighLatency',
]);
const expectedMetricNames = [
  'work_archive_readyz_failure_total',
  'work_archive_api_request_total',
  'work_archive_api_request_duration_seconds_bucket',
  'work_archive_auth_refresh_total',
  'work_archive_user_data_rights_total',
  'work_archive_rate_limit_exceeded_total',
  'work_archive_client_header_guard_total',
  'work_archive_sync_conflict_total',
  'work_archive_sync_failed_validation_total',
  'work_archive_sync_duration_seconds_bucket',
  'work_archive_imports_provider_failure_total',
  'work_archive_imports_provider_circuit_open_total',
  'work_archive_imports_provider_duration_seconds_bucket',
];

function lineNumber(index) {
  return index + 1;
}

function pushFinding(index, message) {
  findings.push(`${alertFile}:${lineNumber(index)} ${message}`);
}

function parseKeyValue(trimmed) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*):(?:\s*(.*))?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    value: (match[2] ?? '').trim(),
  };
}

function setRuleField(rule, key, value) {
  if (key === 'alert' || key === 'expr' || key === 'for') {
    rule[key] = value;
  }
}

for (let index = 0; index < lines.length; index += 1) {
  const rawLine = lines[index];
  const trimmed = rawLine.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    continue;
  }

  if (trimmed.startsWith('- alert:')) {
    currentRule = {
      annotations: {},
      labels: {},
      line: lineNumber(index),
    };
    rules.push(currentRule);
    currentSection = null;
    currentRule.alert = trimmed.slice('- alert:'.length).trim();
    continue;
  }

  if (!currentRule) {
    continue;
  }

  if (trimmed === 'labels:') {
    currentSection = 'labels';
    continue;
  }
  if (trimmed === 'annotations:') {
    currentSection = 'annotations';
    continue;
  }

  const parsed = parseKeyValue(trimmed);
  if (!parsed) {
    pushFinding(index, `could not parse line "${trimmed}".`);
    continue;
  }

  if (currentSection === 'labels') {
    currentRule.labels[parsed.key] = parsed.value;
  } else if (currentSection === 'annotations') {
    currentRule.annotations[parsed.key] = parsed.value;
  } else {
    setRuleField(currentRule, parsed.key, parsed.value);
  }
}

if (!text.endsWith('\n')) {
  findings.push(`${alertFile}:EOF file must end with a newline.`);
}

if (!/^groups:\n/m.test(text)) {
  findings.push(`${alertFile}:1 missing top-level groups key.`);
}

if (!/name:\s+work-archive-gate1/.test(text)) {
  findings.push(`${alertFile}: missing work-archive-gate1 group.`);
}

if (rules.length === 0) {
  findings.push(`${alertFile}: no alert rules found.`);
}

const alertNames = new Set();
for (const rule of rules) {
  if (!rule.alert) {
    findings.push(
      `${alertFile}:${rule.line} alert rule is missing alert name.`,
    );
    continue;
  }

  alertNames.add(rule.alert);

  if (!/^WorkArchive[A-Za-z0-9]+$/.test(rule.alert)) {
    findings.push(
      `${alertFile}:${rule.line} alert name must start with WorkArchive and use identifier characters only.`,
    );
  }
  if (!rule.expr) {
    findings.push(`${alertFile}:${rule.line} ${rule.alert} is missing expr.`);
  }
  if (!rule.for) {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} is missing for duration.`,
    );
  }
  if (!['critical', 'warning'].includes(rule.labels.severity)) {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} must use severity critical or warning.`,
    );
  }
  if (rule.labels.service !== 'work_archive_api') {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} must set service=work_archive_api.`,
    );
  }
  for (const key of Object.keys(rule.labels)) {
    if (!allowedRuleLabels.has(key)) {
      findings.push(
        `${alertFile}:${rule.line} ${rule.alert} has unsupported static label "${key}".`,
      );
    }
  }
  if (!rule.annotations.summary) {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} is missing annotations.summary.`,
    );
  }
  if (!rule.annotations.description) {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} is missing annotations.description.`,
    );
  }
  if (
    /[{] *(userId|email|token|cookie|entityId|requestId|path|url) *=/.test(
      rule.expr ?? '',
    )
  ) {
    findings.push(
      `${alertFile}:${rule.line} ${rule.alert} appears to filter on high-cardinality or sensitive labels.`,
    );
  }
}

for (const requiredAlert of requiredAlerts) {
  if (!alertNames.has(requiredAlert)) {
    findings.push(`${alertFile}: missing required alert ${requiredAlert}.`);
  }
}

for (const metricName of expectedMetricNames) {
  if (!text.includes(metricName)) {
    findings.push(`${alertFile}: missing expected metric ${metricName}.`);
  }
}

if (
  !/sum by \(le\) \(rate\(work_archive_api_request_duration_seconds_bucket\[5m\]\)\)/.test(
    text,
  )
) {
  findings.push(
    `${alertFile}: latency alert must aggregate histogram buckets by le.`,
  );
}

if (
  !/sum by \(le, provider\) \(rate\(work_archive_imports_provider_duration_seconds_bucket\{result="success"\}\[5m\]\)\)/.test(
    text,
  )
) {
  findings.push(
    `${alertFile}: import provider latency alert must aggregate histogram buckets by le and provider.`,
  );
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(
  `Prometheus alert rules passed local validation: ${rules.length} rules`,
);
