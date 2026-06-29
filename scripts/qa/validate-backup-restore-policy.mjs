#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function readRequired(path) {
  const fullPath = join(root, path);

  if (!existsSync(fullPath)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(fullPath, 'utf8');
}

function requireIncludes(path, content, needle) {
  if (!content.includes(needle)) {
    failures.push(`${path} must include "${needle}".`);
  }
}

function requirePattern(path, content, pattern, message) {
  if (!pattern.test(content)) {
    failures.push(`${path}: ${message}`);
  }
}

const backupScriptPath = 'scripts/deploy/prod-backup.sh';
const backupVerifyScriptPath = 'scripts/deploy/prod-backup-verify.sh';
const restoreDrillScriptPath = 'scripts/deploy/prod-restore-drill.sh';
const backupPolicyPath = 'docs/operations/BACKUP_POLICY.md';
const restoreDrillDocPath =
  'docs/operations/deployment/BACKUP_RESTORE_DRILL.md';
const productionChecklistPath =
  'docs/operations/deployment/PRODUCTION_ENV_CHECKLIST.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const gate1EvidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const packagePath = 'package.json';

const backupScript = readRequired(backupScriptPath);
const backupVerifyScript = readRequired(backupVerifyScriptPath);
const restoreDrillScript = readRequired(restoreDrillScriptPath);
const backupPolicy = readRequired(backupPolicyPath);
const restoreDrillDoc = readRequired(restoreDrillDocPath);
const productionChecklist = readRequired(productionChecklistPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const gate1Evidence = readRequired(gate1EvidencePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const packageJson = readRequired(packagePath);

for (const [path, content] of [
  [backupScriptPath, backupScript],
  [backupVerifyScriptPath, backupVerifyScript],
  [restoreDrillScriptPath, restoreDrillScript],
]) {
  requireIncludes(path, content, 'set -Eeuo pipefail');
  requireIncludes(path, content, 'redact()');
  requireIncludes(path, content, '[REDACTED]');
  requireIncludes(path, content, 'DATABASE_URL');
  requireIncludes(path, content, 'REDIS_URL');
  requireIncludes(path, content, 'TOKEN');
  requireIncludes(path, content, 'PASSWORD');
  requireIncludes(path, content, 'Basic ');
  requireIncludes(path, content, 'id[-_]?token');
  requireIncludes(path, content, 'refresh[-_]?token');
  requireIncludes(path, content, 'oauth[-_]?code');
  requireIncludes(path, content, 'nonce');
  requireIncludes(path, content, 'credential');
  requireIncludes(path, content, 'rediss?://');
  requireIncludes(path, content, 'printf \'%s\\n\' "$1" | redact >&2');
}

requireIncludes(backupScriptPath, backupScript, 'umask 077');
requireIncludes(backupScriptPath, backupScript, '--format=custom');
requireIncludes(backupScriptPath, backupScript, '--no-owner');
requireIncludes(backupScriptPath, backupScript, '--no-privileges');
requireIncludes(backupScriptPath, backupScript, 'pg_restore --list');
requireIncludes(backupScriptPath, backupScript, 'sha256sum -c');
requireIncludes(backupScriptPath, backupScript, 'Move this file off-host');
requireIncludes(backupScriptPath, backupScript, 'tmp/backups');
requireIncludes(backupScriptPath, backupScript, 'prod-backup-${timestamp}.md');

requireIncludes(backupVerifyScriptPath, backupVerifyScript, 'BACKUP_FILE');
requireIncludes(backupVerifyScriptPath, backupVerifyScript, 'CHECKSUM_FILE');
requireIncludes(backupVerifyScriptPath, backupVerifyScript, 'sha256sum -c');
requireIncludes(backupVerifyScriptPath, backupVerifyScript, 'pg_restore --list');
requireIncludes(
  backupVerifyScriptPath,
  backupVerifyScript,
  'prod-backup-verify-${timestamp}.md',
);

requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  "RESTORE_DRILL_CONFIRM:-",
);
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  "RESTORE_DRILL_PLAN_ONLY:-false",
);
requireIncludes(restoreDrillScriptPath, restoreDrillScript, 'write_plan_only_report()');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, 'restore-drill-plan-$STAMP.md');
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  'No Docker, pg_restore, migration, startup, smoke, or destructive restore',
);
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  'restore-disposable-target',
);
requireIncludes(restoreDrillScriptPath, restoreDrillScript, '.env.restore');
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  'scripts/deploy/prod-backup-verify.sh',
);
requireIncludes(restoreDrillScriptPath, restoreDrillScript, '--clean');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, '--if-exists');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, '--no-owner');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, '--no-privileges');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, 'api-migrate');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, 'beta-smoke.sh');
requireIncludes(restoreDrillScriptPath, restoreDrillScript, 'ENV_FILE="$ENV_FILE"');
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  'COMPOSE_FILE="$COMPOSE_FILE"',
);
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  'Observed restore drill duration seconds',
);
requireIncludes(
  restoreDrillScriptPath,
  restoreDrillScript,
  '$(printf \'%s\' "${BASE_URL:-not configured}" | redact)',
);

for (const [path, content] of [
  [backupPolicyPath, backupPolicy],
  [restoreDrillDocPath, restoreDrillDoc],
  [productionChecklistPath, productionChecklist],
  [commercialReadinessPath, commercialReadiness],
  [gate1EvidencePath, gate1Evidence],
]) {
  requireIncludes(path, content, 'npm run ops:backup');
  requireIncludes(path, content, 'npm run ops:backup:verify');
  requireIncludes(path, content, 'npm run ops:restore-drill');
  requireIncludes(path, content, 'sha256');
  requireIncludes(path, content, 'off-host');
  requireIncludes(path, content, 'restore drill');
}

for (const [path, content] of [
  [backupPolicyPath, backupPolicy],
  [restoreDrillDocPath, restoreDrillDoc],
  [productionChecklistPath, productionChecklist],
]) {
  requireIncludes(path, content, '.env.restore');
  requireIncludes(path, content, 'RESTORE_DRILL_BASE_URL');
  requireIncludes(path, content, 'RESTORE_DRILL_PLAN_ONLY=true');
  requireIncludes(path, content, 'restore-drill-plan-*.md');
}

requirePattern(
  packagePath,
  packageJson,
  /"ops:backup":\s*"scripts\/deploy\/prod-backup\.sh"/,
  'package.json must expose ops:backup.',
);
requirePattern(
  packagePath,
  packageJson,
  /"ops:backup:verify":\s*"scripts\/deploy\/prod-backup-verify\.sh"/,
  'package.json must expose ops:backup:verify.',
);
requirePattern(
  packagePath,
  packageJson,
  /"ops:restore-drill":\s*"scripts\/deploy\/prod-restore-drill\.sh"/,
  'package.json must expose ops:restore-drill.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:backup-restore-policy":\s*"node scripts\/qa\/validate-backup-restore-policy\.mjs"/,
  'package.json must expose qa:backup-restore-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-backup-restore-policy\.mjs/,
  'commercial repository gates must syntax-check backup/restore policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:backup-restore-policy/,
  'commercial repository gates must run qa:backup-restore-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /RESTORE_DRILL_PLAN_ONLY=true npm run ops:restore-drill/,
  'commercial repository gates must run the restore drill plan-only review.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/validate-backup-restore-policy\.mjs/,
  'Gate 1 local evidence helper must syntax-check backup/restore policy validation.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /npm run qa:backup-restore-policy/,
  'Gate 1 local evidence helper must run qa:backup-restore-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /RESTORE_DRILL_PLAN_ONLY=true npm run ops:restore-drill/,
  'Gate 1 local evidence helper must run the restore drill plan-only review.',
);

if (failures.length > 0) {
  console.error('Backup/restore policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Backup/restore policy check passed.');
