#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

function walkFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function extractSyncEntityTypes(syncConstants) {
  const match = /SYNC_ENTITY_TYPES\s*=\s*\[([\s\S]*?)\]\s+as const/.exec(
    syncConstants,
  );

  if (!match) {
    failures.push(
      'apps/api/src/modules/sync/sync.constants.ts must define SYNC_ENTITY_TYPES as a const array.',
    );
    return [];
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

const bolaPath = 'docs/security/BOLA_MATRIX.md';
const syncConstantsPath = 'apps/api/src/modules/sync/sync.constants.ts';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';

const bola = readRequired(bolaPath);
const syncConstants = readRequired(syncConstantsPath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);

requireIncludes(bolaPath, bola, '## Object Ownership Matrix');
requireIncludes(bolaPath, bola, '## Release Gate');
requireIncludes(bolaPath, bola, 'npm run qa:bola-matrix');

const requiredRestFamilies = [
  'work',
  'user_record',
  'release_record',
  'import_provider_credential',
  'notion_connection',
  'catalog_submission',
];

for (const family of requiredRestFamilies) {
  requireIncludes(bolaPath, bola, `\`${family}\``);
}

for (const entityType of extractSyncEntityTypes(syncConstants)) {
  requireIncludes(bolaPath, bola, `\`${entityType}\``);
}

for (const line of bola.split('\n')) {
  if (!line.startsWith('| `')) {
    continue;
  }

  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

  if (cells.length < 7) {
    failures.push(`${bolaPath}: malformed BOLA matrix row: ${line}`);
    continue;
  }

  const badStatuses = cells
    .slice(1, 6)
    .filter((cell) => /(^|\s)(gap|partial)($|\s)/.test(cell));

  if (badStatuses.length > 0) {
    failures.push(
      `${bolaPath}: ${cells[0]} still has unresolved BOLA status: ${badStatuses.join(', ')}`,
    );
  }
}

const forbiddenStandaloneControllerPatterns = [
  /timeline.*\.controller\.ts$/,
  /user-series.*\.controller\.ts$/,
  /series.*\.controller\.ts$/,
  /contributors?.*\.controller\.ts$/,
  /work-(series|contributor|relation).*\.controller\.ts$/,
  /tier-boards?.*\.controller\.ts$/,
  /tier-(lanes?|cards?|assets?).*\.controller\.ts$/,
];

const forbiddenStandaloneControllers = walkFiles(join(root, 'apps/api/src'))
  .map((file) => relative(root, file))
  .filter((file) =>
    forbiddenStandaloneControllerPatterns.some((pattern) => pattern.test(file)),
  );

if (forbiddenStandaloneControllers.length > 0) {
  failures.push(
    `${bolaPath} marks timeline, personal graph, and tier board objects as not_exposed outside sync, but found standalone controller(s): ${forbiddenStandaloneControllers.join(', ')}`,
  );
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:bola-matrix":\s*"node scripts\/qa\/validate-bola-matrix\.mjs"/,
  'package.json must expose qa:bola-matrix.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-bola-matrix\.mjs/,
  'commercial repository gates must syntax-check BOLA matrix validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:bola-matrix/,
  'commercial repository gates must run qa:bola-matrix.',
);

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:bola-matrix');
  requireIncludes(path, content, 'BOLA');
}

if (failures.length > 0) {
  console.error('BOLA matrix check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('BOLA matrix check passed.');
