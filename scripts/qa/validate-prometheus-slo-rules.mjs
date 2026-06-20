#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const sloFile = resolve(
  rootDir,
  process.argv[2] ?? 'docs/operations/monitoring/work-archive-slo-rules.yml',
);
const text = readFileSync(sloFile, 'utf8');
const lines = text.split(/\r?\n/);
const findings = [];
const rules = [];
let currentRule = null;
let currentSection = null;

const requiredRecords = new Set([
  'work_archive:slo_api_availability:ratio_5m',
  'work_archive:slo_api_availability:ratio_30d',
  'work_archive:slo_api_latency:p95_5m',
  'work_archive:slo_api_latency:p95_30d',
  'work_archive:slo_auth_refresh_success:ratio_30d',
  'work_archive:slo_sync_success:ratio_30d',
  'work_archive:slo_import_search_success:ratio_30d',
]);

const requiredAlerts = new Set([
  'WorkArchiveApiAvailabilitySloBurn',
  'WorkArchiveApiLatencySloBurn',
  'WorkArchiveAuthRefreshSloBurn',
  'WorkArchiveSyncSloBurn',
  'WorkArchiveImportSearchSloBurn',
]);

const expectedMetricNames = [
  'work_archive_api_request_total',
  'work_archive_api_request_duration_seconds_bucket',
  'work_archive_auth_refresh_total',
  'work_archive_sync_total',
  'work_archive_imports_search_total',
];

const allowedRecordLabels = new Set([
  'objective',
  'service',
  'target',
  'target_seconds',
  'window',
]);
const allowedAlertLabels = new Set(['severity', 'service', 'slo']);
const expectedTargets = new Map([
  ['api_availability', '0.995'],
  ['auth_refresh_success', '0.99'],
  ['sync_success', '0.99'],
  ['import_search_success', '0.95'],
]);
const expectedLatencyTargetSeconds = '1';
const disallowedLabels = [
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

function lineNumber(index) {
  return index + 1;
}

function pushFinding(index, message) {
  findings.push(`${sloFile}:${lineNumber(index)} ${message}`);
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
  if (
    key === 'record' ||
    key === 'alert' ||
    key === 'expr' ||
    key === 'for'
  ) {
    rule[key] = value;
  }
}

function startRule(index, kind, value) {
  currentRule = {
    annotations: {},
    kind,
    labels: {},
    line: lineNumber(index),
  };
  currentRule[kind] = value;
  rules.push(currentRule);
  currentSection = null;
}

for (let index = 0; index < lines.length; index += 1) {
  const rawLine = lines[index];
  const trimmed = rawLine.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    continue;
  }

  if (trimmed.startsWith('- record:')) {
    startRule(index, 'record', trimmed.slice('- record:'.length).trim());
    continue;
  }

  if (trimmed.startsWith('- alert:')) {
    startRule(index, 'alert', trimmed.slice('- alert:'.length).trim());
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
    currentRule.labels[parsed.key] = parsed.value.replace(/^"|"$/g, '');
  } else if (currentSection === 'annotations') {
    currentRule.annotations[parsed.key] = parsed.value;
  } else {
    setRuleField(currentRule, parsed.key, parsed.value);
  }
}

function validatePromql(rule) {
  if (!rule.expr) {
    findings.push(`${sloFile}:${rule.line} ${rule.record ?? rule.alert} is missing expr.`);
    return;
  }

  for (const labelName of disallowedLabels) {
    const filterPattern = new RegExp(`[,{]\\s*${labelName}\\s*=`);
    const groupingPattern = new RegExp(`by\\s*\\([^)]*\\b${labelName}\\b`);
    if (filterPattern.test(rule.expr) || groupingPattern.test(rule.expr)) {
      findings.push(`${sloFile}:${rule.line} ${rule.record ?? rule.alert} uses disallowed label "${labelName}".`);
    }
  }
}

function validateRecord(rule) {
  if (!/^work_archive:slo_[a-z0-9_]+:(ratio|p95)_(5m|30d)$/.test(rule.record ?? '')) {
    findings.push(`${sloFile}:${rule.line} invalid SLO recording rule name "${rule.record ?? ''}".`);
  }
  if (rule.labels.service !== 'work_archive_api') {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must set service=work_archive_api.`);
  }
  if (!rule.labels.objective) {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must set an objective label.`);
  }
  if (!['5m', '30d'].includes(rule.labels.window)) {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must set window=5m or window=30d.`);
  }
  for (const key of Object.keys(rule.labels)) {
    if (!allowedRecordLabels.has(key)) {
      findings.push(`${sloFile}:${rule.line} ${rule.record} has unsupported label "${key}".`);
    }
  }

  const expectedTarget = expectedTargets.get(rule.labels.objective);
  if (rule.labels.window === '30d' && expectedTarget && rule.labels.target !== expectedTarget) {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must set target=${expectedTarget}.`);
  }
  if (
    rule.labels.window === '30d' &&
    rule.labels.objective === 'api_latency_p95' &&
    rule.labels.target_seconds !== expectedLatencyTargetSeconds
  ) {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must set target_seconds=${expectedLatencyTargetSeconds}.`);
  }
  if (
    /work_archive_api_request_duration_seconds_bucket/.test(rule.expr ?? '') &&
    !/histogram_quantile\(0\.95, sum by \(le\) \(rate\(work_archive_api_request_duration_seconds_bucket\[(5m|30d)\]\)\)\)/.test(rule.expr)
  ) {
    findings.push(`${sloFile}:${rule.line} ${rule.record} must aggregate latency histogram buckets by le.`);
  }
}

function validateAlert(rule) {
  if (!/^WorkArchive[A-Za-z0-9]+SloBurn$/.test(rule.alert ?? '')) {
    findings.push(`${sloFile}:${rule.line} invalid SLO alert name "${rule.alert ?? ''}".`);
  }
  if (!rule.for) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} is missing for duration.`);
  }
  if (!['critical', 'warning'].includes(rule.labels.severity)) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} must use severity critical or warning.`);
  }
  if (rule.labels.service !== 'work_archive_api') {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} must set service=work_archive_api.`);
  }
  if (!rule.labels.slo) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} must set a slo label.`);
  }
  for (const key of Object.keys(rule.labels)) {
    if (!allowedAlertLabels.has(key)) {
      findings.push(`${sloFile}:${rule.line} ${rule.alert} has unsupported label "${key}".`);
    }
  }
  if (!rule.annotations.summary) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} is missing annotations.summary.`);
  }
  if (!rule.annotations.description) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} is missing annotations.description.`);
  }
  if (!/(work_archive:slo_[a-z0-9_]+:(ratio|p95)_30d)/.test(rule.expr ?? '')) {
    findings.push(`${sloFile}:${rule.line} ${rule.alert} must alert on a 30d SLO recording rule.`);
  }
}

if (!text.endsWith('\n')) {
  findings.push(`${sloFile}:EOF file must end with a newline.`);
}

if (!/^groups:\n/m.test(text)) {
  findings.push(`${sloFile}:1 missing top-level groups key.`);
}

if (!/name:\s+work-archive-slo/.test(text)) {
  findings.push(`${sloFile}: missing work-archive-slo group.`);
}

if (rules.length === 0) {
  findings.push(`${sloFile}: no SLO rules found.`);
}

const recordNames = new Set();
const alertNames = new Set();

for (const rule of rules) {
  validatePromql(rule);

  if (rule.kind === 'record') {
    recordNames.add(rule.record);
    validateRecord(rule);
  } else if (rule.kind === 'alert') {
    alertNames.add(rule.alert);
    validateAlert(rule);
  }
}

for (const requiredRecord of requiredRecords) {
  if (!recordNames.has(requiredRecord)) {
    findings.push(`${sloFile}: missing required recording rule ${requiredRecord}.`);
  }
}

for (const requiredAlert of requiredAlerts) {
  if (!alertNames.has(requiredAlert)) {
    findings.push(`${sloFile}: missing required SLO alert ${requiredAlert}.`);
  }
}

for (const metricName of expectedMetricNames) {
  if (!text.includes(metricName)) {
    findings.push(`${sloFile}: missing expected metric ${metricName}.`);
  }
}

if (!/clamp_min\(sum\(rate\(work_archive_api_request_total\[30d\]\)\), 1\)/.test(text)) {
  findings.push(`${sloFile}: API availability ratio must guard zero traffic with clamp_min.`);
}

if (!/work_archive:slo_import_search_success:ratio_30d < 0\.95/.test(text)) {
  findings.push(`${sloFile}: import search SLO alert must use the 0.95 Gate 1 target.`);
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

const recordCount = rules.filter((rule) => rule.kind === 'record').length;
const alertCount = rules.filter((rule) => rule.kind === 'alert').length;
console.log(
  `Prometheus SLO rules passed local validation: ${recordCount} records, ${alertCount} alerts`,
);
