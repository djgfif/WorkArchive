#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const schemaPath = path.join(rootDir, 'apps/api/prisma/schema.prisma');
const ownerDocPath = path.join(rootDir, 'docs/security/OWNER_INVARIANTS.md');
const asvsPath = path.join(rootDir, 'docs/security/ASVS_COVERAGE.md');
const packagePath = path.join(rootDir, 'package.json');
const gatesPath = path.join(rootDir, 'scripts/qa/commercial-repo-gates.sh');
const localEvidencePath = path.join(rootDir, 'scripts/qa/gate1-evidence-local.sh');
const requiredMigrationPath = path.join(
  rootDir,
  'apps/api/prisma/migrations/20260614001000_require_user_work_record_user_id/migration.sql',
);

const errors = [];

const schema = readFile(schemaPath);
const ownerDoc = readFile(ownerDocPath);
const asvs = readFile(asvsPath);
const packageJson = readFile(packagePath);
const gates = readFile(gatesPath);
const localEvidence = readFile(localEvidencePath);
const migration = readFile(requiredMigrationPath);

const userWorkRecordModel = /model\s+UserWorkRecord\s+\{([\s\S]*?)\n\}/.exec(
  schema,
)?.[1];

if (!userWorkRecordModel) {
  errors.push('UserWorkRecord model is missing from Prisma schema.');
} else {
  if (!/^\s*userId\s+String(?:\s|$)/m.test(userWorkRecordModel)) {
    errors.push('UserWorkRecord.userId must be required String in Prisma schema.');
  }

  if (/^\s*userId\s+String\?/m.test(userWorkRecordModel)) {
    errors.push('UserWorkRecord.userId must not be nullable in Prisma schema.');
  }

  if (
    !/^\s*user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/m.test(
      userWorkRecordModel,
    )
  ) {
    errors.push(
      'UserWorkRecord.user relation must cascade from required userId.',
    );
  }
}

if (!/ALTER TABLE "user_work_records" ALTER COLUMN "userId" SET NOT NULL;/.test(migration)) {
  errors.push(
    'Required owner migration must set user_work_records.userId NOT NULL.',
  );
}

if (/currently nullable|Do not change the schema until production data has been checked/i.test(ownerDoc)) {
  errors.push('OWNER_INVARIANTS.md still describes userId as a future nullable migration.');
}

if (!/`UserWorkRecord\.userId` is required/i.test(ownerDoc)) {
  errors.push('OWNER_INVARIANTS.md must state that UserWorkRecord.userId is required.');
}

if (/make `?UserWorkRecord\.userId`? non-null/i.test(asvs)) {
  errors.push('ASVS coverage still lists UserWorkRecord.userId non-null as remaining work.');
}

requireText(packagePath, packageJson, '"qa:owner-invariants": "node scripts/qa/validate-owner-invariants.mjs"');
requireText(gatesPath, gates, 'node --check scripts/qa/validate-owner-invariants.mjs');
requireText(gatesPath, gates, 'npm run qa:owner-invariants');
requireText(localEvidencePath, localEvidence, 'node --check scripts/qa/validate-owner-invariants.mjs');
requireText(localEvidencePath, localEvidence, 'npm run qa:owner-invariants');

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }

  process.exit(1);
}

console.log('Owner invariant check passed: UserWorkRecord.userId is required and documented.');

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    errors.push(`Cannot read ${path.relative(rootDir, filePath)}: ${error.message}`);

    return '';
  }
}

function requireText(filePath, content, value) {
  if (!content.includes(value)) {
    errors.push(`${path.relative(rootDir, filePath)} must include "${value}".`);
  }
}
