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
const metricsControllerPath = 'apps/api/src/observability/metrics.controller.ts';
const imageProxyControllerPath =
  'apps/api/src/modules/image-proxy/image-proxy.controller.ts';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const betaSmokePath = 'scripts/deploy/beta-smoke.sh';
const prodHealthcheckPath = 'scripts/deploy/prod-healthcheck.sh';
const nginxPath = 'apps/web/nginx.conf';
const apiCachePolicyPath = 'docs/security/API_CACHE_POLICY.md';
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
const metricsController = readRequired(metricsControllerPath);
const imageProxyController = readRequired(imageProxyControllerPath);
const appSecurityTest = readRequired(appSecurityTestPath);
const betaSmoke = readRequired(betaSmokePath);
const prodHealthcheck = readRequired(prodHealthcheckPath);
const nginx = readRequired(nginxPath);
const apiCachePolicy = readRequired(apiCachePolicyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);

requireIncludes(configureAppPath, configureApp, 'createApiNoStoreMiddleware');
requireIncludes(configureAppPath, configureApp, 'app.use(createApiNoStoreMiddleware())');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'createApiNoStoreMiddleware');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'shouldApplyApiNoStore');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'NO_STORE_OPERATIONAL_PATHS');
requireIncludes(securityMiddlewarePath, securityMiddleware, "response.setHeader('Cache-Control', 'no-store')");
requirePattern(
  securityMiddlewarePath,
  securityMiddleware,
  /pathname !== '\/api\/image-proxy'/,
  'image proxy must remain exempt from the generic API no-store middleware.',
);
for (const path of ['/health', '/livez', '/readyz']) {
  requireIncludes(securityMiddlewarePath, securityMiddleware, path);
}

requireIncludes(metricsControllerPath, metricsController, "@Header('Cache-Control', 'no-store')");
requireIncludes(imageProxyControllerPath, imageProxyController, "'Cache-Control': image.cacheControl");

for (const needle of [
  'marks API responses as no-store by default',
  'marks operational health responses as no-store',
  "headers.get('cache-control')).toBe('no-store')",
  'does not override the public image proxy cache policy',
  "shouldApplyApiNoStore('/api/image-proxy",
]) {
  requireIncludes(appSecurityTestPath, appSecurityTest, needle);
}

for (const [path, content] of [
  [betaSmokePath, betaSmoke],
  [prodHealthcheckPath, prodHealthcheck],
]) {
  requireIncludes(path, content, '^cache-control:.*no-store');
  for (const endpoint of ['/health', '/livez', '/readyz']) {
    requireIncludes(path, content, endpoint);
  }
}

requireIncludes(betaSmokePath, betaSmoke, 'metrics endpoint is not cached');
requireIncludes(prodHealthcheckPath, prodHealthcheck, 'assert_no_store_header');
for (const [location, upstream] of [
  ['/health', 'http://api:3000/health'],
  ['/livez', 'http://api:3000/livez'],
  ['/readyz', 'http://api:3000/readyz'],
  ['/metrics', 'http://api:3000/metrics'],
]) {
  requireIncludes(nginxPath, nginx, `location ${location}`);
  requireIncludes(nginxPath, nginx, `proxy_pass ${upstream};`);
}

for (const phrase of [
  'API cache policy',
  'Cache-Control: no-store',
  'image proxy',
  'health',
  'livez',
  'readyz',
  'npm run qa:api-cache-policy',
]) {
  requireIncludes(apiCachePolicyPath, apiCachePolicy, phrase);
}

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:api-cache-policy');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:api-cache-policy":\s*"node scripts\/qa\/validate-api-cache-policy\.mjs"/,
  'package.json must expose qa:api-cache-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-api-cache-policy\.mjs/,
  'commercial repository gates must syntax-check API cache policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:api-cache-policy/,
  'commercial repository gates must run qa:api-cache-policy.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:api-cache-policy');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:api-cache-policy');

if (failures.length > 0) {
  console.error('API cache policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('API cache policy check passed.');
