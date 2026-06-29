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
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const auditServicePath = 'apps/api/src/security/security-audit.service.ts';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const csrfPolicyPath = 'docs/security/CSRF_POLICY.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';

const configureApp = readRequired(configureAppPath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const auditService = readRequired(auditServicePath);
const appSecurityTest = readRequired(appSecurityTestPath);
const csrfPolicy = readRequired(csrfPolicyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);

requirePattern(
  configureAppPath,
  configureApp,
  /createProductionFetchMetadataGuard\(config,\s*securityAudit\)[\s\S]*createProductionOriginGuard\(config,\s*securityAudit\)[\s\S]*createProductionClientHeaderGuard/,
  'CSRF-oriented Fetch Metadata and Origin guards must run before the production client-header guard.',
);
requirePattern(
  configureAppPath,
  configureApp,
  /app\.enableCors\(\{[\s\S]{0,420}allowedHeaders:\s*API_CORS_ALLOWED_HEADERS,[\s\S]{0,420}credentials:\s*true,[\s\S]{0,420}exposedHeaders:\s*API_CORS_EXPOSED_HEADERS,[\s\S]{0,420}maxAge:\s*API_CORS_PREFLIGHT_MAX_AGE_SECONDS,[\s\S]{0,420}methods:\s*API_CORS_METHODS,[\s\S]{0,420}origin:\s*config\.corsOrigin,[\s\S]{0,120}\}\)/,
  'CORS must keep the configured origin allowlist, credentials, and explicit method/header preflight allowlists.',
);
requireIncludes(configureAppPath, configureApp, 'API_CORS_ALLOWED_HEADERS');
requireIncludes(configureAppPath, configureApp, "'Authorization'");
requireIncludes(configureAppPath, configureApp, "'Content-Type'");
requireIncludes(configureAppPath, configureApp, "'X-Request-Id'");
requireIncludes(configureAppPath, configureApp, "'X-Work-Archive-Client'");
requireIncludes(configureAppPath, configureApp, 'API_CORS_EXPOSED_HEADERS');
requireIncludes(configureAppPath, configureApp, 'API_CORS_METHODS');
requireIncludes(configureAppPath, configureApp, "'PUT'");
requireIncludes(configureAppPath, configureApp, "'PATCH'");
requireIncludes(configureAppPath, configureApp, 'API_CORS_PREFLIGHT_MAX_AGE_SECONDS = 600');

requireIncludes(securityMiddlewarePath, securityMiddleware, 'const SAFE_METHODS');
requireIncludes(securityMiddlewarePath, securityMiddleware, "'GET'");
requireIncludes(securityMiddlewarePath, securityMiddleware, "'HEAD'");
requireIncludes(securityMiddlewarePath, securityMiddleware, "'OPTIONS'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'fetchSite !== \'cross-site\'');
requireIncludes(securityMiddlewarePath, securityMiddleware, "eventType: 'http.fetch_metadata_blocked'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'Cross-site unsafe requests are not allowed.');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'const allowedOrigins = new Set(config.corsOrigin)');
requireIncludes(securityMiddlewarePath, securityMiddleware, "fetchSite === 'same-origin'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'origin && allowedOrigins.has(origin)');
requireIncludes(securityMiddlewarePath, securityMiddleware, "origin: origin ?? 'missing'");
requireIncludes(securityMiddlewarePath, securityMiddleware, "eventType: 'http.origin_blocked'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'Origin is not allowed.');

requireIncludes(auditServicePath, auditService, "'http.fetch_metadata_blocked'");
requireIncludes(auditServicePath, auditService, "'http.origin_blocked'");

for (const phrase of [
  'blocks unsafe production requests without an allowed Origin',
  'req_origin_blocked_1',
  'uses explicit CORS preflight methods and request headers for allowed origins',
  'blocks cross-site unsafe requests with Fetch Metadata before Origin fallback',
  'req_fetch_metadata_blocked_1',
  'allows same-origin unsafe requests with Fetch Metadata even when Origin is absent',
  'checks same-site unsafe request origins when Fetch Metadata is present',
  'blocks same-site unsafe requests without Origin instead of trusting Fetch Metadata alone',
  'checks user-initiated none unsafe request origins and blocks missing Origin',
  'keeps OAuth top-level GET callback flows outside unsafe CSRF blocking',
]) {
  requireIncludes(appSecurityTestPath, appSecurityTest, phrase);
}

for (const phrase of [
  'Fetch Metadata',
  'Origin allowlist',
  'same-origin',
  'same-site',
  'Sec-Fetch-Site',
  'unsafe requests',
  'http.fetch_metadata_blocked',
  'http.origin_blocked',
  'npm run qa:csrf-policy',
]) {
  requireIncludes(csrfPolicyPath, csrfPolicy, phrase);
}

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:csrf-policy');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:csrf-policy":\s*"node scripts\/qa\/validate-csrf-policy\.mjs"/,
  'package.json must expose qa:csrf-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-csrf-policy\.mjs/,
  'commercial repository gates must syntax-check CSRF policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:csrf-policy/,
  'commercial repository gates must run qa:csrf-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node syntax: CSRF policy validator/,
  'Gate 1 local evidence helper must syntax-check CSRF policy validation.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:csrf-policy');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:csrf-policy');

if (failures.length > 0) {
  console.error('CSRF policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('CSRF policy check passed.');
