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

const refreshCookiePath = 'apps/api/src/modules/auth/auth.cookies.ts';
const authTypesPath = 'apps/api/src/modules/auth/auth.types.ts';
const googleOAuthPath = 'apps/api/src/modules/auth/auth-google-oauth.ts';
const authServicePath = 'apps/api/src/modules/auth/auth.service.ts';
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const authServiceTestPath = 'apps/api/test/auth.service.spec.ts';
const authControllerTestPath = 'apps/api/test/auth.controller.spec.ts';
const authProfileTestPath = 'apps/api/test/auth.profile.e2e-spec.ts';
const deploymentChecklistPath =
  'docs/operations/deployment/PRODUCTION_ENV_CHECKLIST.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const packagePath = 'package.json';

const refreshCookie = readRequired(refreshCookiePath);
const authTypes = readRequired(authTypesPath);
const googleOAuth = readRequired(googleOAuthPath);
const authService = readRequired(authServicePath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const authServiceTest = readRequired(authServiceTestPath);
const authControllerTest = readRequired(authControllerTestPath);
const authProfileTest = readRequired(authProfileTestPath);
const deploymentChecklist = readRequired(deploymentChecklistPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const packageJson = readRequired(packagePath);

requireIncludes(
  refreshCookiePath,
  refreshCookie,
  "export const REFRESH_TOKEN_COOKIE_NAME = 'work_archive_refresh_token';",
);
requireIncludes(refreshCookiePath, refreshCookie, 'const REFRESH_TOKEN_TTL_MS');
requireIncludes(refreshCookiePath, refreshCookie, '1000 * 60 * 60 * 24 * 30');
requireIncludes(refreshCookiePath, refreshCookie, 'httpOnly: true');
requireIncludes(refreshCookiePath, refreshCookie, "path: '/api/auth'");
requireIncludes(
  refreshCookiePath,
  refreshCookie,
  "sameSite: config.isProduction ? 'strict' : 'lax'",
);
requireIncludes(refreshCookiePath, refreshCookie, 'secure: config.cookieSecure');
requireIncludes(refreshCookiePath, refreshCookie, 'maxAge: _maxAge');

requireIncludes(
  authTypesPath,
  authTypes,
  "export const AUTH_JWT_ALGORITHM = 'HS256' as const;",
);
requireIncludes(
  authTypesPath,
  authTypes,
  "export const AUTH_JWT_AUDIENCE = 'work-archive-web';",
);
requireIncludes(
  authTypesPath,
  authTypes,
  "export const AUTH_JWT_ISSUER = 'work-archive-api';",
);
requireIncludes(authTypesPath, authTypes, 'AUTH_ACCESS_TOKEN_TTL_SECONDS');
requireIncludes(authTypesPath, authTypes, 'AUTH_REFRESH_TOKEN_TTL_SECONDS');
requireIncludes(authTypesPath, authTypes, 'AUTH_JWT_CLOCK_SKEW_SECONDS');
requireIncludes(authTypesPath, authTypes, 'hasRequiredAuthJwtClaims');
requireIncludes(authTypesPath, authTypes, "typeof payload.exp === 'number'");
requireIncludes(authTypesPath, authTypes, "typeof payload.iat === 'number'");
requireIncludes(authTypesPath, authTypes, "typeof payload.jti === 'string'");
requireIncludes(authTypesPath, authTypes, 'isSafeAuthTokenIdentifierClaim');
requireIncludes(authTypesPath, authTypes, 'hasExpectedAuthIdentityClaims');
requireIncludes(authTypesPath, authTypes, 'isSafeAuthTokenEmailClaim');
requireIncludes(authTypesPath, authTypes, 'hasExpectedAuthTemporalClaims');
requireIncludes(authTypesPath, authTypes, 'payload.exp - payload.iat <= maxLifetimeSeconds');
requireIncludes(authTypesPath, authTypes, 'payload.iat <= nowSeconds + AUTH_JWT_CLOCK_SKEW_SECONDS');
requireIncludes(authTypesPath, authTypes, 'hasExpectedAuthTokenKindClaims');
requireIncludes(authTypesPath, authTypes, "type === 'access'");
requireIncludes(
  authTypesPath,
  authTypes,
  "typeof maybeRememberedPayload.rememberMe === 'boolean'",
);
requireIncludes(authServicePath, authService, 'algorithm: AUTH_JWT_ALGORITHM');
requireIncludes(authServicePath, authService, 'audience: AUTH_JWT_AUDIENCE');
requireIncludes(authServicePath, authService, 'issuer: AUTH_JWT_ISSUER');
requireIncludes(authServicePath, authService, 'algorithms: [AUTH_JWT_ALGORITHM]');
requireIncludes(authServicePath, authService, 'hasRequiredAuthJwtClaims');
requireIncludes(authServicePath, authService, 'hasExpectedAuthIdentityClaims');
requireIncludes(authServicePath, authService, 'hasExpectedAuthTemporalClaims');
requireIncludes(authServicePath, authService, 'hasExpectedAuthTokenKindClaims');
requireIncludes(authServicePath, authService, 'isTokenEmailCurrentForUser');
requireIncludes(authServicePath, authService, 'token_email_mismatch');
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'algorithms: [AUTH_JWT_ALGORITHM]',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'audience: AUTH_JWT_AUDIENCE',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'issuer: AUTH_JWT_ISSUER',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'hasRequiredAuthJwtClaims',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'hasExpectedAuthIdentityClaims',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'hasExpectedAuthTemporalClaims',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'hasExpectedAuthTokenKindClaims',
);

requireIncludes(
  googleOAuthPath,
  googleOAuth,
  "export const GOOGLE_OAUTH_FLOW_COOKIE = 'wa_google_oauth_flow';",
);
requireIncludes(googleOAuthPath, googleOAuth, '1000 * 60 * 10');
requireIncludes(googleOAuthPath, googleOAuth, 'httpOnly: true');
requireIncludes(googleOAuthPath, googleOAuth, "path: '/api/auth/google'");
requireIncludes(googleOAuthPath, googleOAuth, "sameSite: 'lax' as const");
requireIncludes(googleOAuthPath, googleOAuth, 'secure: config.cookieSecure');

requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'uses strict secure refresh cookies in production',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'omits maxAge for browser-session cookies when remember-me is off',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'uses a 30-day persistent cookie when remember-me is on',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'issues HS256 JWTs and rejects access tokens signed with another HMAC algorithm',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects access tokens with an unexpected issuer or audience',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects access tokens missing required registered JWT claims',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects tokens whose kind-specific claims do not match the issued shape',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects tokens whose identity claims are unsafe',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects tokens whose lifetime exceeds the issued policy',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects tokens whose issued-at time is too far in the future',
);
requireIncludes(
  authServiceTestPath,
  authServiceTest,
  'rejects tokens whose email claim no longer matches the user',
);
requireIncludes(
  authControllerTestPath,
  authControllerTest,
  'clears the refresh cookie when refresh token validation fails',
);
requireIncludes(
  authProfileTestPath,
  authProfileTest,
  'does not overwrite the refresh cookie for a grace-window refresh race response',
);

for (const path of [
  deploymentChecklistPath,
  asvsPath,
  commercialReadinessPath,
]) {
  const content =
    path === deploymentChecklistPath
      ? deploymentChecklist
      : path === asvsPath
        ? asvs
        : commercialReadiness;

  requireIncludes(path, content, 'HttpOnly');
  requireIncludes(path, content, 'Secure');
  requireIncludes(path, content, 'SameSite=Strict');
  requireIncludes(path, content, '/api/auth');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:auth-session-policy":\s*"node scripts\/qa\/validate-auth-session-policy\.mjs"/,
  'package.json must expose qa:auth-session-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-auth-session-policy\.mjs/,
  'commercial repository gates must syntax-check auth session policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:auth-session-policy/,
  'commercial repository gates must run qa:auth-session-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/validate-auth-session-policy\.mjs/,
  'Gate 1 local evidence helper must syntax-check auth session policy validation.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /npm run qa:auth-session-policy/,
  'Gate 1 local evidence helper must run qa:auth-session-policy.',
);

if (failures.length > 0) {
  console.error('Auth session policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Auth session policy check passed.');
