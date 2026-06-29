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

const packagePath = 'package.json';
const packageLockPath = 'package-lock.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const secureSdlcPath = 'docs/security/SECURE_SDLC.md';
const scanResultsPath = 'docs/security/SECURITY_SCAN_RESULTS.md';
const releaseChecklistPath = 'docs/operations/RELEASE_CHECKLIST.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const githubChecklistPath = 'docs/security/GITHUB_SECURITY_SETTINGS_CHECKLIST.md';

const packageJson = readRequired(packagePath);
const packageLock = readRequired(packageLockPath);
const gates = readRequired(gatesPath);
const secureSdlc = readRequired(secureSdlcPath);
const scanResults = readRequired(scanResultsPath);
const releaseChecklist = readRequired(releaseChecklistPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const githubChecklist = readRequired(githubChecklistPath);

requirePattern(
  packagePath,
  packageJson,
  /"security:audit:prod:high":\s*"npm audit --omit=dev --audit-level=high"/,
  'package.json must expose security:audit:prod:high.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:secure-sdlc-policy":\s*"node scripts\/qa\/validate-secure-sdlc-policy\.mjs"/,
  'package.json must expose qa:secure-sdlc-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-secure-sdlc-policy\.mjs/,
  'commercial repository gates must syntax-check secure SDLC validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:secure-sdlc-policy/,
  'commercial repository gates must run qa:secure-sdlc-policy.',
);

for (const [path, content] of [
  [secureSdlcPath, secureSdlc],
  [scanResultsPath, scanResults],
  [releaseChecklistPath, releaseChecklist],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
  [githubChecklistPath, githubChecklist],
]) {
  requireIncludes(path, content, 'security:audit:prod:high');
  requireIncludes(path, content, 'high or critical');
  requireIncludes(path, content, 'waiver');
}

requireIncludes(secureSdlcPath, secureSdlc, 'Vulnerability Triage SLA');
requireIncludes(secureSdlcPath, secureSdlc, 'production runtime dependencies');
requireIncludes(secureSdlcPath, secureSdlc, 'reachable server-side path');
requireIncludes(secureSdlcPath, secureSdlc, 'owner');
requireIncludes(secureSdlcPath, secureSdlc, 'expiry');

requireIncludes(packagePath, packageJson, '"multer": "2.2.0"');
requireIncludes(packagePath, packageJson, '"js-yaml": "5.1.0"');
requirePattern(
  packageLockPath,
  packageLock,
  /"node_modules\/multer":\s*\{\s*"version":\s*"2\.2\.0"/,
  'package-lock.json must resolve node_modules/multer to 2.2.0.',
);
requirePattern(
  packageLockPath,
  packageLock,
  /"node_modules\/js-yaml":\s*\{\s*"version":\s*"5\.1\.0"/,
  'package-lock.json must resolve node_modules/js-yaml to 5.1.0.',
);
requirePattern(
  packageLockPath,
  packageLock,
  /"node_modules\/undici":\s*\{\s*"version":\s*"7\.28\.0"/,
  'package-lock.json must resolve node_modules/undici to 7.28.0.',
);
requireIncludes(scanResultsPath, scanResults, 'multer@2.2.0');
requireIncludes(scanResultsPath, scanResults, 'undici@7.28.0');
requireIncludes(scanResultsPath, scanResults, 'js-yaml@5.1.0');
requireIncludes(scanResultsPath, scanResults, 'found 0 vulnerabilities');
requireIncludes(scanResultsPath, scanResults, 'public beta release status: high gate passed');

requireIncludes(
  evidencePath,
  evidence,
  'Production npm audit high/critical gate',
);
requireIncludes(evidencePath, evidence, 'Vulnerability waivers');

if (failures.length > 0) {
  console.error('Secure SDLC policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Secure SDLC policy check passed.');
