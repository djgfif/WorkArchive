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

const servicePath = 'apps/api/src/modules/image-proxy/image-proxy.service.ts';
const policyPath = 'apps/api/src/modules/image-proxy/image-proxy-policy.ts';
const externalFetchPath = 'apps/api/src/common/external-fetch.ts';
const networkPolicyPath = 'apps/api/src/common/network-address-policy.ts';
const externalFetchTestPath = 'apps/api/test/external-fetch.spec.ts';
const serviceTestPath = 'apps/api/test/image-proxy.service.spec.ts';
const policyTestPath = 'apps/api/test/image-proxy-policy.spec.ts';
const networkPolicyTestPath = 'apps/api/test/network-address-policy.spec.ts';
const imageProxyPlanPath = 'docs/security/IMAGE_PROXY_PLAN.md';
const apiAuthSurfacePath = 'docs/security/API_AUTHORIZATION_SURFACE.md';
const apiCachePolicyPath = 'docs/security/API_CACHE_POLICY.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';

const service = readRequired(servicePath);
const policy = readRequired(policyPath);
const externalFetch = readRequired(externalFetchPath);
const networkPolicy = readRequired(networkPolicyPath);
const externalFetchTest = readRequired(externalFetchTestPath);
const serviceTest = readRequired(serviceTestPath);
const policyTest = readRequired(policyTestPath);
const networkPolicyTest = readRequired(networkPolicyTestPath);
const imageProxyPlan = readRequired(imageProxyPlanPath);
const apiAuthSurface = readRequired(apiAuthSurfacePath);
const apiCachePolicy = readRequired(apiCachePolicyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);

for (const needle of [
  'parseAllowedImageUrl(rawUrl)',
  'assertAllowedImageUrl(nextUrl)',
  'await this.assertPublicNetworkTarget(url)',
  'resolvePublicNetworkAddress(url.hostname)',
  'allowedHostnameSuffixes: ALLOWED_IMAGE_HOST_SUFFIXES',
  "redirect: 'manual'",
  'maxResponseBytes: MAX_IMAGE_BYTES',
  'timeoutMs: FETCH_TIMEOUT_MS',
  'getAllowedImageContentType(response)',
  'readLimitedImageBody(response)',
  'MAX_HOST_CONCURRENT_FETCHES',
  'MAX_HOST_FETCHES_PER_WINDOW',
]) {
  requireIncludes(servicePath, service, needle);
}

for (const needle of [
  'JSON.stringify',
  "event: 'image_proxy.fetch_failed'",
  'host: url.hostname',
  'describeOperationalError(error)',
]) {
  requireIncludes(servicePath, service, needle);
}
for (const forbidden of [
  'this.logger.warn({',
  'url: url.toString()',
  'href: url.href',
]) {
  if (service.includes(forbidden)) {
    failures.push(`${servicePath} must not log image proxy failures via ${forbidden}.`);
  }
}

for (const needle of [
  'url.protocol !== \'https:\'',
  'url.port',
  'ALLOWED_IMAGE_HOST_SUFFIXES',
  'MAX_IMAGE_BYTES',
  'content-length',
  'public, max-age=86400, stale-while-revalidate=604800',
  'work-archive:image-proxy:',
]) {
  requireIncludes(policyPath, policy, needle);
}
for (const needle of [
  'url.protocol !== \'https:\'',
  'url.username || url.password',
  'url.port',
  'External request URL requires an explicit hostname allowlist.',
  'resolvePublicNetworkAddress(hostname)',
]) {
  requireIncludes(externalFetchPath, externalFetch, needle);
}
requirePattern(
  policyPath,
  policy,
  /const ALLOWED_CONTENT_TYPES = new Set\(\[[\s\S]*'image\/webp'[\s\S]*\]\);/,
  'allowed content types must be an explicit raster allowlist.',
);

for (const needle of [
  'dns.lookup(normalizedHostname',
  'private_address',
  'readIpv4MappedIpv6Address',
  'isPublicIpv4Address(mappedIpv4)',
  'matchesIpv6Prefix',
]) {
  requireIncludes(networkPolicyPath, networkPolicy, needle);
}

for (const needle of [
  'blocks non-default HTTPS ports before fetch',
  'https://api.example.com:8443/data.json',
]) {
  requireIncludes(externalFetchTestPath, externalFetchTest, needle);
}
for (const needle of [
  'rejects local or private image host',
  'rejects allowlisted hosts that resolve to private addresses',
  'rejects allowlisted hosts that resolve to IPv4-mapped private IPv6 addresses',
  'validates redirect target DNS against private addresses',
  'logs only the image provider host and safe error code on upstream failures',
  'secret-token',
]) {
  requireIncludes(serviceTestPath, serviceTest, needle);
}
for (const needle of [
  'rejects missing, invalid, non-https, and untrusted URLs',
  'https://covers.openlibrary.org:8443/b/id/123-L.jpg',
  'rejects oversized image bodies from content length',
  'image/svg+xml',
  'work-archive:image-proxy:',
]) {
  requireIncludes(policyTestPath, policyTest, needle);
}
for (const needle of [
  'blocks private and special-use IPv4 ranges',
  'blocks private and special-use IPv6 ranges',
  '::ffff:127.0.0.1',
]) {
  requireIncludes(networkPolicyTestPath, networkPolicyTest, needle);
}

for (const phrase of [
  'DNS resolution with localhost, private, reserved, and IPv4-mapped private IPv6',
  'Default port only',
  'redirect target revalidation',
  'full URL logging avoidance',
  'npm run qa:image-proxy-policy',
]) {
  requireIncludes(imageProxyPlanPath, imageProxyPlan, phrase);
}
for (const [path, content] of [
  [apiAuthSurfacePath, apiAuthSurface],
  [apiCachePolicyPath, apiCachePolicy],
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:image-proxy-policy');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:image-proxy-policy":\s*"node scripts\/qa\/validate-image-proxy-policy\.mjs"/,
  'package.json must expose qa:image-proxy-policy.',
);
requireIncludes(
  gatesPath,
  gates,
  'node --check scripts/qa/validate-image-proxy-policy.mjs',
);
requireIncludes(gatesPath, gates, 'npm run qa:image-proxy-policy');
requireIncludes(
  localEvidencePath,
  localEvidence,
  'node --check scripts/qa/validate-image-proxy-policy.mjs',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:image-proxy-policy');

if (failures.length > 0) {
  console.error('Image proxy policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Image proxy policy check passed.');
