#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const evidenceFile = resolve(
  rootDir,
  process.argv[2] ?? 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md',
);
const strict =
  process.env.GATE1_EVIDENCE_STRICT === 'true' ||
  process.argv.includes('--strict');
const text = readFileSync(evidenceFile, 'utf8');
const findings = [];
const warnings = [];

const requiredSections = [
  'Release Candidate',
  'Repository Gates',
  'GitHub Controls',
  'Host Preflight And Smoke',
  'Metrics And Alerts',
  'Backup And Restore Drill',
  'Smoke-Level Performance Baseline',
  'Decision',
];

const requiredPassCommands = [
  'npm run security:public',
  'npm run check:docs-links',
  'npm run lint',
  'npm run typecheck',
  'npm run test',
  'npm run build',
  'npm run qa:migrations',
  'npm run qa:import-search',
  'npm run qa:sync-load',
  'npm run test:e2e:web',
  'npm run test:e2e',
  'docker compose -f compose.prod.yml --env-file .env.prod config',
];

const requiredNonEmptyFields = [
  'Public beta URL',
  'Release notes or ticket',
  'Branch protection enabled for `master`',
  'Required checks',
  'CodeQL result',
  'Dependabot enabled',
  'Secret scanning enabled',
  'Push protection enabled',
  'scripts/deploy/beta-preflight.sh',
  'Migration command',
  'API/web startup',
  'scripts/deploy/beta-smoke.sh',
  '/health',
  '/livez',
  '/readyz',
  '`/metrics` public unauthenticated exposure result',
  '`/metrics` internal collector bearer-token result',
  'Google OAuth login/logout',
  'Guest JSON export/import',
  'Guest-to-account transfer review',
  'Authenticated sync push/pull',
  'Sync conflict resolution',
  'Import provider failure fallback',
  'npm run qa:alerts',
  'npm run qa:slo',
  'npm run qa:dashboards',
  '`npm run qa:monitoring` report',
  'Alert rule file deployed',
  'SLO rule file deployed',
  'Grafana dashboard file deployed',
  'Grafana dashboard UID',
  'Prometheus/collector target for `/metrics`',
  'Alertmanager or notification channel',
  'API availability SLO 30d',
  'API latency p95 SLO 30d',
  'Auth refresh success SLO 30d',
  'Sync success SLO 30d',
  'Import search success SLO 30d',
  'Public unauthenticated `/metrics` result',
  'Internal collector `/metrics` result',
  'Backup command (`npm run ops:backup`)',
  'Backup report (`tmp/backups/prod-backup-*.md` summary only)',
  'Backup file identifier',
  'Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only)',
  'Off-host copy location',
  'Restore target (must be disposable/non-production)',
  'Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only)',
  'Restore start/end time',
  'Observed RPO',
  'Observed RTO',
  'Post-restore `/readyz`',
  'Post-restore sync smoke',
  'Performance smoke command',
  'Performance smoke report',
  'Authenticated disposable account used for sync timing',
  'Public beta approved',
  'Approver',
];

const placeholderPatterns = [
  /\bnot run\b/i,
  /\bnot verified\b/i,
  /\bnot measured\b/i,
  /\bnot available\b/i,
  /\bnot yet assigned\b/i,
  /\bpending\b/i,
  /\bblocked\b/i,
  /\bmanual\b/i,
  /\brequires?\b/i,
  /\bdry-run\b/i,
  /\bdry run\b/i,
  /\blocal development\b/i,
  /\bbeta host required\b/i,
  /\brequires beta host\b/i,
];

function addFinding(message) {
  findings.push(`${evidenceFile}: ${message}`);
}

function addWarning(message) {
  warnings.push(`${evidenceFile}: ${message}`);
}

function extractSection(title) {
  const pattern = new RegExp(
    `^## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=^## |$)`,
    'm',
  );
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBulletValue(label) {
  const escapedLabel = escapeRegex(label);
  const pattern = new RegExp(`^- ${escapedLabel}:[ \t]*(.*)$`, 'm');
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}

function isBlank(value) {
  return value === null || value === '';
}

function hasPlaceholder(value) {
  return placeholderPatterns.some((pattern) => pattern.test(value));
}

function commandLine(command) {
  const escaped = escapeRegex(command);
  const pattern = new RegExp('^- `' + escaped + '`:[ \t]*(.*)$', 'm');
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}

function validateSections() {
  for (const section of requiredSections) {
    if (extractSection(section) === null) {
      addFinding(`missing required section "${section}".`);
    }
  }
}

function validateStatus() {
  const statusMatch = /^Status:\s*(.*)$/m.exec(text);
  const status = statusMatch?.[1]?.trim() ?? '';
  if (!status) {
    addFinding('missing top-level Status line.');
    return;
  }
  if (/partial|pending|blocked|not run|incomplete/i.test(status)) {
    addFinding(`top-level Status is not release-ready: "${status}".`);
  }
}

function validateRepositoryGates() {
  for (const command of requiredPassCommands) {
    const value = commandLine(command);
    if (isBlank(value)) {
      addFinding(`missing repository gate result for ${command}.`);
      continue;
    }
    if (!/^PASS\b/.test(value)) {
      addFinding(`repository gate ${command} is not PASS: "${value}".`);
    }
  }
}

function validateFields() {
  for (const label of requiredNonEmptyFields) {
    const value = findBulletValue(label);
    if (isBlank(value)) {
      addFinding(`required evidence field "${label}" is blank or missing.`);
      continue;
    }
    if (hasPlaceholder(value)) {
      addFinding(`required evidence field "${label}" still looks incomplete: "${value}".`);
    }
  }
}

function validateMetricsExposure() {
  const publicMetrics = findBulletValue('Public unauthenticated `/metrics` result');
  if (publicMetrics && !/\b404\b/.test(publicMetrics)) {
    addFinding('public unauthenticated /metrics result must explicitly include 404.');
  }

  const internalMetrics = findBulletValue('Internal collector `/metrics` result');
  if (internalMetrics && !/\b200\b/.test(internalMetrics)) {
    addFinding('internal collector /metrics result must explicitly include 200.');
  }
}

function validatePerformanceTable() {
  const section = extractSection('Smoke-Level Performance Baseline');
  if (!section) {
    return;
  }

  const rows = section
    .split(/\r?\n/)
    .filter((line) => /^\| `/.test(line));
  if (rows.length === 0) {
    addFinding('performance baseline table has no measured scenario rows.');
    return;
  }

  for (const row of rows) {
    if (hasPlaceholder(row)) {
      addFinding(`performance baseline row is incomplete: "${row}".`);
    }
  }
}

function validateDecision() {
  const approved = findBulletValue('Public beta approved');
  if (approved && !/\b(yes|approved|true)\b/i.test(approved)) {
    addFinding(`public beta approval is not affirmative: "${approved}".`);
  }
}

function validateSecretSafety() {
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i.test(text)) {
    addFinding('evidence ledger appears to contain a bearer token.');
  }
  if (/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)=\S+/i.test(text)) {
    addFinding('evidence ledger appears to contain secret-like environment values.');
  }
  if (/postgres(?:ql)?:\/\/[^@\s]+@/i.test(text)) {
    addFinding('evidence ledger appears to contain a database URL with credentials.');
  }
}

function validateNotes() {
  const followUpBlockers = findBulletValue('Follow-up blockers');
  if (followUpBlockers && !/none|n\/a|no\b/i.test(followUpBlockers)) {
    addWarning(`follow-up blockers are recorded: "${followUpBlockers}".`);
  }
}

validateSections();
validateStatus();
validateRepositoryGates();
validateFields();
validateMetricsExposure();
validatePerformanceTable();
validateDecision();
validateSecretSafety();
validateNotes();

for (const warning of warnings) {
  console.warn(warning);
}

if (findings.length > 0) {
  const summary = `Gate 1 evidence is incomplete: ${findings.length} required item(s) need attention.`;
  if (strict) {
    console.error([summary, ...findings].join('\n'));
    process.exit(1);
  }

  console.log(summary);
  console.log('Run with GATE1_EVIDENCE_STRICT=true or --strict to fail public beta approval on these findings.');
  for (const finding of findings.slice(0, 40)) {
    console.log(`- ${finding}`);
  }
  if (findings.length > 40) {
    console.log(`- [${findings.length - 40} additional finding(s) omitted]`);
  }
  process.exit(0);
}

console.log('Gate 1 evidence completeness validation passed.');
