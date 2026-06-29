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

function requireExcludes(path, content, needle, message) {
  if (content.includes(needle)) {
    failures.push(`${path} must not include ${message}.`);
  }
}

function requirePattern(path, content, pattern, message) {
  if (!pattern.test(content)) {
    failures.push(`${path}: ${message}`);
  }
}

const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const apiRuntimeConfigPath = 'apps/api/src/config/api-runtime-config.ts';
const apiRuntimeConfigTestPath = 'apps/api/test/api-runtime-config.spec.ts';
const importCircuitPath =
  'apps/api/src/operations/import-provider-circuit-clear.ts';
const importCircuitTestPath =
  'apps/api/test/import-provider-circuit-clear.spec.ts';
const importOperationsDocPath =
  'docs/archive/backend/IMPORT_PROVIDER_OPERATIONS.md';
const retentionOperationPath = 'apps/api/src/operations/retention-cleanup.ts';
const retentionTargetsPath =
  'apps/api/src/operations/retention-cleanup.targets.ts';
const retentionTestPath = 'apps/api/test/retention-cleanup.spec.ts';
const prismaServicePath = 'apps/api/src/prisma/prisma.service.ts';
const prismaServiceTestPath = 'apps/api/test/prisma.service.spec.ts';
const retentionPolicyPath = 'docs/security/DATA_RETENTION_AND_PRIVACY.md';
const runbookPath = 'docs/operations/RUNBOOK.md';
const productionChecklistPath =
  'docs/operations/deployment/PRODUCTION_ENV_CHECKLIST.md';

const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const apiRuntimeConfig = readRequired(apiRuntimeConfigPath);
const apiRuntimeConfigTest = readRequired(apiRuntimeConfigTestPath);
const importCircuit = readRequired(importCircuitPath);
const importCircuitTest = readRequired(importCircuitTestPath);
const importOperationsDoc = readRequired(importOperationsDocPath);
const retentionOperation = readRequired(retentionOperationPath);
const retentionTargets = readRequired(retentionTargetsPath);
const retentionTest = readRequired(retentionTestPath);
const prismaService = readRequired(prismaServicePath);
const prismaServiceTest = readRequired(prismaServiceTestPath);
const retentionPolicy = readRequired(retentionPolicyPath);
const runbook = readRequired(runbookPath);
const productionChecklist = readRequired(productionChecklistPath);

requirePattern(
  packagePath,
  packageJson,
  /"qa:operator-safety":\s*"node scripts\/qa\/validate-operator-safety\.mjs"/,
  'package.json must expose qa:operator-safety.',
);
requireIncludes(
  gatesPath,
  gates,
  'node --check scripts/qa/validate-operator-safety.mjs',
);
requireIncludes(gatesPath, gates, 'npm run qa:operator-safety');
requireIncludes(
  localEvidencePath,
  localEvidence,
  'node --check scripts/qa/validate-operator-safety.mjs',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:operator-safety');

for (const value of ['true', 'false']) {
  requireIncludes(importCircuitPath, importCircuit, `'${value}'`);
  requireIncludes(retentionTargetsPath, retentionTargets, `'${value}'`);
}

for (const value of ['yes', 'no', 'on', 'off']) {
  requireExcludes(
    importCircuitPath,
    importCircuit,
    `'${value}'`,
    `legacy dry-run alias ${value}`,
  );
  requireExcludes(
    retentionTargetsPath,
    retentionTargets,
    `'${value}'`,
    `legacy dry-run alias ${value}`,
  );
}

requireIncludes(
  importCircuitPath,
  importCircuit,
  'IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN must be true or false.',
);
requireIncludes(
  importCircuitPath,
  importCircuit,
  'formatImportProviderCircuitClearFailure(error)',
);
requireIncludes(
  importCircuitPath,
  importCircuit,
  'operations.import_provider_circuit.clear_failed',
);
requireIncludes(
  importCircuitTestPath,
  importCircuitTest,
  'rejects invalid dry-run boolean values before touching runtime state',
);
requireIncludes(
  importCircuitTestPath,
  importCircuitTest,
  'formats operation failures without raw Redis or token errors',
);
requireIncludes(importCircuitTestPath, importCircuitTest, "'flase'");
requireIncludes(importCircuitTestPath, importCircuitTest, "'yes'");
requireIncludes(
  importOperationsDocPath,
  importOperationsDoc,
  'IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN',
);
requireIncludes(
  runbookPath,
  runbook,
  'IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN',
);
requireIncludes(
  importOperationsDocPath,
  importOperationsDoc,
  'accepts only explicit boolean values',
);
requireIncludes(
  runbookPath,
  runbook,
  'accepts only explicit boolean values',
);

requireIncludes(
  retentionTargetsPath,
  retentionTargets,
  'RETENTION_CLEANUP_DRY_RUN must be true or false.',
);
requireIncludes(
  retentionOperationPath,
  retentionOperation,
  'formatRetentionCleanupFailure(error)',
);
requireIncludes(
  retentionOperationPath,
  retentionOperation,
  'operations.retention_cleanup.failed',
);
requireIncludes(
  retentionTestPath,
  retentionTest,
  'rejects invalid dry-run boolean values before cleanup can run',
);
requireIncludes(
  retentionTestPath,
  retentionTest,
  'formats operation failures without raw database errors',
);
requireIncludes(retentionTestPath, retentionTest, "'flase'");
requireIncludes(retentionTestPath, retentionTest, "'yes'");
requireIncludes(
  retentionPolicyPath,
  retentionPolicy,
  'RETENTION_CLEANUP_DRY_RUN',
);
requireIncludes(
  runbookPath,
  runbook,
  'RETENTION_CLEANUP_DRY_RUN',
);
requireIncludes(
  productionChecklistPath,
  productionChecklist,
  'RETENTION_CLEANUP_DRY_RUN',
);
requireIncludes(
  retentionPolicyPath,
  retentionPolicy,
  'accepts only explicit boolean values',
);
requireIncludes(
  productionChecklistPath,
  productionChecklist,
  'accepts only explicit boolean values',
);
requireIncludes(
  prismaServicePath,
  prismaService,
  'PRISMA_CONNECT_TIMEOUT_MS must be a positive integer.',
);
requireIncludes(prismaServicePath, prismaService, '/^[1-9]\\d*$/.test(value)');
requireIncludes(
  prismaServiceTestPath,
  prismaServiceTest,
  'rejects PostgreSQL connect timeout values with suffixes or decimals',
);
requireIncludes(prismaServiceTestPath, prismaServiceTest, "'2500ms'");
requireIncludes(runbookPath, runbook, 'PRISMA_CONNECT_TIMEOUT_MS');
requireIncludes(
  productionChecklistPath,
  productionChecklist,
  'PRISMA_CONNECT_TIMEOUT_MS',
);
requireIncludes(apiRuntimeConfigPath, apiRuntimeConfig, '/^[1-9]\\d*$/.test');
requireIncludes(apiRuntimeConfigPath, apiRuntimeConfig, 'must be a safe integer');
requireIncludes(
  apiRuntimeConfigTestPath,
  apiRuntimeConfigTest,
  'rejects non-plain or unsafe integer runtime settings before startup',
);
requireIncludes(apiRuntimeConfigTestPath, apiRuntimeConfigTest, "'1e4'");
requireIncludes(apiRuntimeConfigTestPath, apiRuntimeConfigTest, "'60000ms'");
requireIncludes(
  runbookPath,
  runbook,
  'exponent notation and unit suffixes fail startup validation',
);
requireIncludes(
  productionChecklistPath,
  productionChecklist,
  'All numeric API runtime env values must be plain positive decimal integers',
);

if (failures.length > 0) {
  console.error('Operator safety policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Operator safety policy check passed.');
