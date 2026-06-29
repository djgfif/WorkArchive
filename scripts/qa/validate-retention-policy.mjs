#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const expectedTargets = [
  'security_events',
  'user_refresh_sessions',
  'user_sync_applied_mutations',
  'notion_pull_preview_snapshots',
];

const policyFiles = [
  'docs/security/DATA_RETENTION_AND_PRIVACY.md',
  'docs/operations/RUNBOOK.md',
  'docs/operations/deployment/PRODUCTION_ENV_CHECKLIST.md',
  'docs/operations/BETA_HOST_REHEARSAL.md',
  'docs/archive/backend/STABILITY_HARDENING.md',
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md',
];
const operationalPolicyFiles = policyFiles.filter(
  (file) => file !== 'docs/security/DATA_RETENTION_AND_PRIVACY.md',
);

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(fullPath, 'utf8');
}

function requireIncludes(path, content, value) {
  if (!content.includes(value)) {
    failures.push(`${path} must include "${value}".`);
  }
}

function requireExcludes(path, content, pattern, description) {
  if (pattern.test(content)) {
    failures.push(`${path} must not contain stale ${description}.`);
  }
}

const targetsSource = readRequired(
  'apps/api/src/operations/retention-cleanup.targets.ts',
);
const testsSource = readRequired('apps/api/test/retention-cleanup.spec.ts');
const packageJson = readRequired('package.json');
const gates = readRequired('scripts/qa/commercial-repo-gates.sh');
const localEvidence = readRequired('scripts/qa/gate1-evidence-local.sh');

for (const target of expectedTargets) {
  requireIncludes(
    'apps/api/src/operations/retention-cleanup.targets.ts',
    targetsSource,
    `name: '${target}'`,
  );
  requireIncludes('apps/api/test/retention-cleanup.spec.ts', testsSource, target);
}

requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  "const PRODUCTION_CONFIRMATION = 'delete-expired-operational-data';",
);
requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  'RETENTION_CLEANUP_DRY_RUN must be true or false.',
);
requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  '/^[1-9]\\d*$/.test(normalizedValue)',
);
requireIncludes(
  'apps/api/test/retention-cleanup.spec.ts',
  testsSource,
  'rejects invalid dry-run boolean values before cleanup can run',
);
requireIncludes(
  'apps/api/test/retention-cleanup.spec.ts',
  testsSource,
  "RETENTION_CLEANUP_DRY_RUN: 'flase'",
);
requireIncludes(
  'apps/api/test/retention-cleanup.spec.ts',
  testsSource,
  'rejects retention day values with suffixes or decimals',
);
requireIncludes(
  'apps/api/test/retention-cleanup.spec.ts',
  testsSource,
  "RETENTION_SECURITY_EVENT_DAYS: '180days'",
);
requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  'DEFAULT_SECURITY_EVENT_RETENTION_DAYS = 180',
);
requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  'DEFAULT_REVOKED_REFRESH_SESSION_RETENTION_DAYS = 30',
);
requireIncludes(
  'apps/api/src/operations/retention-cleanup.targets.ts',
  targetsSource,
  'DEFAULT_EXPIRED_REFRESH_SESSION_RETENTION_DAYS = 30',
);

for (const file of policyFiles) {
  const content = readRequired(file);

  for (const target of expectedTargets) {
    requireIncludes(file, content, target);
  }
}

for (const file of operationalPolicyFiles) {
  const content = readRequired(file);

  requireExcludes(
    file,
    content,
    /password_reset_tokens|RETENTION_(USED|EXPIRED)_PASSWORD_RESET_TOKEN_DAYS/i,
    'password reset retention targets',
  );
}

const privacyPolicy = readRequired('docs/security/DATA_RETENTION_AND_PRIVACY.md');
requireIncludes(
  'docs/security/DATA_RETENTION_AND_PRIVACY.md',
  privacyPolicy,
  'Historical Client Metadata Policy',
);
requireIncludes(
  'docs/security/DATA_RETENTION_AND_PRIVACY.md',
  privacyPolicy,
  'Backup Sensitivity Policy',
);
requireIncludes(
  'docs/security/DATA_RETENTION_AND_PRIVACY.md',
  privacyPolicy,
  'RETENTION_CLEANUP_DRY_RUN',
);
requireIncludes(
  'docs/security/DATA_RETENTION_AND_PRIVACY.md',
  privacyPolicy,
  'accepts only explicit boolean values',
);

requireIncludes(
  'package.json',
  packageJson,
  '"qa:retention-policy": "node scripts/qa/validate-retention-policy.mjs"',
);
requireIncludes(
  'scripts/qa/commercial-repo-gates.sh',
  gates,
  'npm run qa:retention-policy',
);
requireIncludes(
  'scripts/qa/gate1-evidence-local.sh',
  localEvidence,
  'node --check scripts/qa/validate-retention-policy.mjs',
);
requireIncludes(
  'scripts/qa/gate1-evidence-local.sh',
  localEvidence,
  'npm run qa:retention-policy',
);

if (failures.length > 0) {
  console.error('Retention policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Retention policy check passed.');
