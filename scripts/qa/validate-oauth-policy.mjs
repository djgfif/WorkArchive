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

const authControllerPath = 'apps/api/src/modules/auth/auth.controller.ts';
const oauthHelperPath = 'apps/api/src/modules/auth/auth-google-oauth.ts';
const oauthHelperTestPath = 'apps/api/test/auth-google-oauth.spec.ts';
const authProfileTestPath = 'apps/api/test/auth.profile.e2e-spec.ts';
const authServiceTestPath = 'apps/api/test/auth.service.spec.ts';
const worksE2eTestPath = 'apps/api/test/works.e2e-spec.ts';
const structuredLogTestPath = 'apps/api/test/auth.structured-logs.spec.ts';
const betaSmokePath = 'scripts/deploy/beta-smoke.sh';
const oauthPolicyPath = 'docs/security/OAUTH_POLICY.md';
const securityChecklistPath = 'docs/security/SECURITY_CHECKLIST.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';

const authController = readRequired(authControllerPath);
const oauthHelper = readRequired(oauthHelperPath);
const oauthHelperTest = readRequired(oauthHelperTestPath);
const authProfileTest = readRequired(authProfileTestPath);
const authServiceTest = readRequired(authServiceTestPath);
const worksE2eTest = readRequired(worksE2eTestPath);
const structuredLogTest = readRequired(structuredLogTestPath);
const betaSmoke = readRequired(betaSmokePath);
const oauthPolicy = readRequired(oauthPolicyPath);
const securityChecklist = readRequired(securityChecklistPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);

for (const route of ['register', 'login']) {
  requirePattern(
    authControllerPath,
    authController,
    new RegExp(`@Post\\('${route}'\\)[\\s\\S]{0,360}createLegacyAuthDisabledException`),
    `legacy ${route} route must remain disabled with 410 Gone.`,
  );
}
for (const phrase of [
  "@Get('google/start')",
  '@Query(\'return_origin\') returnOrigin',
  'getAllowedOAuthReturnOrigin(returnOrigin)',
  'const flowId = randomUUID()',
  'const state = generateOAuthSecret()',
  'const nonce = generateOAuthSecret()',
  'hashSecret(state)',
  'hashSecret(nonce)',
  'this.googleOAuthFlowStore.store(',
  'GOOGLE_OAUTH_FLOW_COOKIE',
  'getGoogleOAuthFlowCookieOptions()',
  'consumeGoogleOAuthFlow(flowId, state',
  "eventType: 'auth.login.failure'",
  "event: 'auth.google.failed'",
]) {
  requireIncludes(authControllerPath, authController, phrase);
}

for (const phrase of [
  "export const GOOGLE_OAUTH_FLOW_COOKIE = 'wa_google_oauth_flow';",
  'GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 10',
  "path: '/api/auth/google'",
  "sameSite: 'lax' as const",
  'secure: config.cookieSecure',
  'new URL(config.webBaseUrl).origin',
  'new URL(returnOrigin.trim())',
  "if (!['http:', 'https:'].includes(parsedOrigin.protocol))",
  '...config.corsOrigin.map',
  'allowedOrigins.has(requestedOrigin)',
  "return `${origin}/auth/google/complete`",
  "return `${origin}/auth/login?google=${reason}`",
  "failureReason: 'missing_oauth_flow_cookie'",
  "failureReason: 'missing_oauth_state'",
  "failureReason: 'oauth_flow_not_found'",
  "failureReason: 'invalid_oauth_state'",
  'verifySecret(state, flow.stateHash)',
]) {
  requireIncludes(oauthHelperPath, oauthHelper, phrase);
}

for (const phrase of [
  'allows only configured return origins and falls back to web base origin',
  "getAllowedOAuthReturnOrigin('https://evil.example'",
  "getAllowedOAuthReturnOrigin('javascript:alert(1)'",
  'builds Google login redirect URLs from the allowed origin',
  'builds OAuth cookie options without exposing state or nonce cookies',
  'consumes and validates stored Google OAuth flows',
  'classifies missing, stale, and invalid OAuth flow state',
]) {
  requireIncludes(oauthHelperTestPath, oauthHelperTest, phrase);
}
for (const phrase of [
  'redirects Google callbacks with missing OAuth flow cookies to login failure',
  'missing_oauth_flow_cookie',
  'authService.loginWithGoogleAuthorizationCode).not.toHaveBeenCalled',
]) {
  requireIncludes(authProfileTestPath, authProfileTest, phrase);
}
for (const phrase of [
  'fails Google token exchange quickly when the upstream request aborts',
  'oauth-code-secret',
  'uses stale Google JWKS cache only when the requested kid is cached',
]) {
  requireIncludes(authServiceTestPath, authServiceTest, phrase);
}
for (const phrase of [
  'reports Google OAuth readiness and redirects unconfigured starts to login',
  'https://evil.example',
  'wa_google_oauth_flow=',
  'wa_google_oauth_state=',
  'wa_google_oauth_nonce=',
  'keeps legacy email/password login and registration disabled with 410 Gone',
]) {
  requireIncludes(worksE2eTestPath, worksE2eTest, phrase);
}
requireIncludes(
  structuredLogTestPath,
  structuredLogTest,
  'logs auth.google.failed without OAuth codes, cookies, API keys, or tokens',
);
for (const phrase of [
  'expect_status GET "/api/auth/google/start?return_origin=${ALLOWED_ORIGIN}" 302',
  "header_contains '^set-cookie:.*wa_google_oauth_flow='",
  "header_contains '^set-cookie:.*httponly'",
  "header_contains '^set-cookie:.*secure'",
  "header_contains '^set-cookie:.*samesite=lax'",
  "header_contains '^set-cookie:.*path=/api/auth/google'",
  "header_absent '^set-cookie:.*wa_google_oauth_state='",
  "header_absent '^set-cookie:.*wa_google_oauth_nonce='",
]) {
  requireIncludes(betaSmokePath, betaSmoke, phrase);
}

for (const phrase of [
  'Google OAuth is the only account login path',
  '410 Gone',
  'return_origin',
  'WEB_BASE_URL',
  'CORS_ORIGIN',
  'auth.login.failure',
  'OAuth codes',
  'SameSite=Lax',
  'npm run qa:oauth-policy',
]) {
  requireIncludes(oauthPolicyPath, oauthPolicy, phrase);
}
requireIncludes(securityChecklistPath, securityChecklist, 'Google OAuth is the only account login path.');

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:oauth-policy');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:oauth-policy":\s*"node scripts\/qa\/validate-oauth-policy\.mjs"/,
  'package.json must expose qa:oauth-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-oauth-policy\.mjs/,
  'commercial repository gates must syntax-check OAuth policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:oauth-policy/,
  'commercial repository gates must run qa:oauth-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node syntax: OAuth policy validator/,
  'Gate 1 local evidence helper must syntax-check OAuth policy validation.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:oauth-policy');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:oauth-policy');

if (failures.length > 0) {
  console.error('OAuth policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('OAuth policy check passed.');
