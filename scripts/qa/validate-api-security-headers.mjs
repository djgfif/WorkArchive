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

const configureAppPath = 'apps/api/src/configure-app.ts';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const policyPath = 'docs/security/API_SECURITY_HEADERS.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';
const betaSmokePath = 'scripts/deploy/beta-smoke.sh';

const configureApp = readRequired(configureAppPath);
const appSecurityTest = readRequired(appSecurityTestPath);
const policy = readRequired(policyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);
const betaSmoke = readRequired(betaSmokePath);

requireIncludes(configureAppPath, configureApp, "expressInstance.disable('x-powered-by')");
requireIncludes(configureAppPath, configureApp, "import helmet from 'helmet'");
requireIncludes(configureAppPath, configureApp, 'helmet({');
requireIncludes(configureAppPath, configureApp, 'hidePoweredBy: true');
for (const directive of [
  'baseUri: ["\'none\'"]',
  'defaultSrc: ["\'none\'"]',
  'formAction: ["\'none\'"]',
  'frameAncestors: ["\'none\'"]',
  'objectSrc: ["\'none\'"]',
]) {
  requireIncludes(configureAppPath, configureApp, directive);
}

for (const phrase of [
  'sends the API security header baseline',
  "headers.get('x-powered-by')).toBeNull()",
  "headers.get('x-content-type-options')).toBe('nosniff')",
  "headers.get('referrer-policy')).toBe('no-referrer')",
  "headers.get('strict-transport-security')",
  "contentSecurityPolicy).toContain(\"default-src 'none'\")",
  "contentSecurityPolicy).toContain(\"frame-ancestors 'none'\")",
]) {
  requireIncludes(appSecurityTestPath, appSecurityTest, phrase);
}

for (const phrase of [
  'x-powered-by',
  'helmet',
  'hidePoweredBy: true',
  "default-src 'none'",
  "frame-ancestors 'none'",
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'HSTS',
  'npm run qa:api-security-headers',
]) {
  requireIncludes(policyPath, policy, phrase);
}

for (const phrase of [
  'assert_api_security_headers',
  "header_absent '^x-powered-by:'",
  "header_contains '^x-content-type-options:[[:space:]]*nosniff'",
  "header_contains '^referrer-policy:[[:space:]]*no-referrer'",
  "header_contains '^strict-transport-security:'",
  "header_contains \"^content-security-policy:.*default-src 'none'\"",
  "header_contains \"^content-security-policy:.*frame-ancestors 'none'\"",
]) {
  requireIncludes(betaSmokePath, betaSmoke, phrase);
}

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:api-security-headers');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:api-security-headers":\s*"node scripts\/qa\/validate-api-security-headers\.mjs"/,
  'package.json must expose qa:api-security-headers.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-api-security-headers\.mjs/,
  'commercial repository gates must syntax-check API security header validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:api-security-headers/,
  'commercial repository gates must run qa:api-security-headers.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node syntax: API security headers validator/,
  'Gate 1 local evidence helper must syntax-check API security header validation.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:api-security-headers');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:api-security-headers');

if (failures.length > 0) {
  console.error('API security headers check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('API security headers check passed.');
