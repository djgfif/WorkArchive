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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireRouteGuard(path, content, decorator, route) {
  requirePattern(
    path,
    content,
    new RegExp(
      `@${decorator}\\('${escapeRegExp(route)}'\\)[\\s\\S]{0,420}@UseGuards\\(JwtAuthGuard\\)`,
    ),
    `${decorator}('${route}') must be protected by JwtAuthGuard.`,
  );
  requirePattern(
    path,
    content,
    new RegExp(
      `@${decorator}\\('${escapeRegExp(route)}'\\)[\\s\\S]{0,420}@ApiBearerAuth\\(\\)`,
    ),
    `${decorator}('${route}') must advertise bearer auth in Swagger metadata.`,
  );
}

const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const authSurfacePath = 'docs/security/API_AUTHORIZATION_SURFACE.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const bearerTokenPath = 'apps/api/src/modules/auth/bearer-token.ts';
const bearerTokenTestPath = 'apps/api/test/bearer-token.spec.ts';
const metricsServicePath = 'apps/api/src/observability/metrics.service.ts';
const metricsServiceTestPath = 'apps/api/test/metrics.service.spec.ts';
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const configureAppPath = 'apps/api/src/configure-app.ts';

const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const authSurface = readRequired(authSurfacePath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const bearerToken = readRequired(bearerTokenPath);
const bearerTokenTest = readRequired(bearerTokenTestPath);
const metricsService = readRequired(metricsServicePath);
const metricsServiceTest = readRequired(metricsServiceTestPath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const appSecurityTest = readRequired(appSecurityTestPath);
const configureApp = readRequired(configureAppPath);

const controllerFiles = walkFiles(join(root, 'apps/api/src'))
  .map((file) => relative(root, file))
  .filter((file) => file.endsWith('controller.ts'))
  .sort();

const expectedControllers = [
  'apps/api/src/modules/auth/auth.controller.ts',
  'apps/api/src/modules/catalog/catalog.controller.ts',
  'apps/api/src/modules/health/health.controller.ts',
  'apps/api/src/modules/image-proxy/image-proxy.controller.ts',
  'apps/api/src/modules/imports/imports.controller.ts',
  'apps/api/src/modules/notion/notion.controller.ts',
  'apps/api/src/modules/sync/sync.controller.ts',
  'apps/api/src/modules/user-records/user-records.controller.ts',
  'apps/api/src/modules/user-records/user-release-records.controller.ts',
  'apps/api/src/modules/works/works.controller.ts',
  'apps/api/src/observability/metrics.controller.ts',
].sort();

const unexpectedControllers = controllerFiles.filter(
  (file) => !expectedControllers.includes(file),
);
const missingControllers = expectedControllers.filter(
  (file) => !controllerFiles.includes(file),
);

if (unexpectedControllers.length > 0) {
  failures.push(
    `API authorization surface does not classify controller(s): ${unexpectedControllers.join(', ')}`,
  );
}
if (missingControllers.length > 0) {
  failures.push(
    `API authorization surface expects missing controller(s): ${missingControllers.join(', ')}`,
  );
}

const classGuardedControllers = [
  'apps/api/src/modules/catalog/catalog.controller.ts',
  'apps/api/src/modules/notion/notion.controller.ts',
  'apps/api/src/modules/sync/sync.controller.ts',
  'apps/api/src/modules/user-records/user-records.controller.ts',
  'apps/api/src/modules/user-records/user-release-records.controller.ts',
  'apps/api/src/modules/works/works.controller.ts',
];

for (const path of classGuardedControllers) {
  const content = readRequired(path);
  requireIncludes(path, content, '@ApiBearerAuth()');
  requireIncludes(path, content, '@UseGuards(JwtAuthGuard)');
  requireIncludes(path, content, 'CurrentUser');
}

const importsPath = 'apps/api/src/modules/imports/imports.controller.ts';
const imports = readRequired(importsPath);
for (const [decorator, route] of [
  ['Get', 'providers/aladin/status'],
  ['Put', 'providers/aladin/key'],
  ['Delete', 'providers/aladin/key'],
  ['Put', 'providers/:provider/key'],
  ['Delete', 'providers/:provider/key'],
  ['Post', 'providers/:provider/test'],
  ['Post', 'resolve'],
]) {
  requireRouteGuard(importsPath, imports, decorator, route);
}
requireIncludes(importsPath, imports, 'extractOptionalBearerAccessToken');
requireIncludes(importsPath, imports, 'private async getOptionalUser');
requirePattern(
  importsPath,
  imports,
  /@Get\('providers'\)[\s\S]{0,520}getOptionalUser\(authorizationHeader\)/,
  "GET imports/providers must use optional bearer parsing rather than stored credentials for guests.",
);
requirePattern(
  importsPath,
  imports,
  /@Get\('search'\)[\s\S]{0,620}getOptionalUser\(authorizationHeader\)/,
  "GET imports/search must use optional bearer parsing rather than stored credentials for guests.",
);

requireIncludes(bearerTokenPath, bearerToken, '^Bearer ([^\\s]+)$');
requireIncludes(
  bearerTokenTestPath,
  bearerTokenTest,
  'Bearer access-token extra',
);
requireIncludes(
  bearerTokenTestPath,
  bearerTokenTest,
  'Bearer access-token\\nX-Injected: value',
);
requireIncludes(metricsServicePath, metricsService, '^Bearer ([^\\s]+)$');
requireIncludes(
  metricsServiceTestPath,
  metricsServiceTest,
  'rejects malformed metrics bearer headers with extra segments',
);
requireIncludes(
  metricsServiceTestPath,
  metricsServiceTest,
  'Bearer collector-token-minimum-32-characters extra',
);
requireIncludes(
  metricsServiceTestPath,
  metricsServiceTest,
  'Bearer collector-token-minimum-32-characters\\nX-Injected: value',
);
requireIncludes(securityMiddlewarePath, securityMiddleware, '^Bearer ([^\\s]+)$');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'AUTH_JWT_ALGORITHM');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'AUTH_JWT_AUDIENCE');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'AUTH_JWT_ISSUER');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'hasRequiredAuthJwtClaims');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'hasExpectedAuthIdentityClaims');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'hasExpectedAuthTemporalClaims');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'hasExpectedAuthTokenKindClaims');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'algorithms: [AUTH_JWT_ALGORITHM]');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'audience: AUTH_JWT_AUDIENCE');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'issuer: AUTH_JWT_ISSUER');
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'getVerifiedAccessTokenPayload(request, config) !== null',
);
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'getVerifiedAccessTokenPayload(request, config) === null',
);
requireIncludes(securityMiddlewarePath, securityMiddleware, 'importsProtected');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'imports_protected');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'catalogRateLimitStore');
requireIncludes(securityMiddlewarePath, securityMiddleware, "'catalog'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'mutationRateLimitStore');
requireIncludes(securityMiddlewarePath, securityMiddleware, "'mutations'");
requireIncludes(securityMiddlewarePath, securityMiddleware, 'skip: (request) => SAFE_METHODS.has(request.method)');
requireIncludes(configureAppPath, configureApp, "'/api/imports/resolve'");
requireIncludes(configureAppPath, configureApp, 'rateLimiters.importsProtected');
requireIncludes(configureAppPath, configureApp, "app.use('/api/catalog', rateLimiters.catalog)");
requireIncludes(configureAppPath, configureApp, "'/api/works'");
requireIncludes(configureAppPath, configureApp, "'/api/user-records'");
requireIncludes(configureAppPath, configureApp, "'/api/user-release-records'");
requireIncludes(configureAppPath, configureApp, 'rateLimiters.mutations');
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not treat malformed bearer headers as authenticated for the client header guard',
);
requireIncludes(appSecurityTestPath, appSecurityTest, 'Bearer  test-token');
requireIncludes(appSecurityTestPath, appSecurityTest, '`Bearer  ${firstUserToken}`');
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'counts malformed provider search bearer headers against the guest limiter',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'counts invalid provider search bearer tokens against the guest limiter',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust non-HS256 access tokens for authenticated rate-limit keys',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust access tokens missing required registered claims for authenticated rate-limit keys',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust access tokens with refresh-only claims for authenticated rate-limit keys',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust access tokens with unsafe identity claims for authenticated rate-limit keys',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust long-lived access tokens for authenticated rate-limit keys',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not trust future-issued access tokens for authenticated rate-limit keys',
);
requireIncludes(appSecurityTestPath, appSecurityTest, 'Bearer test-token extra');
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'rate limits protected import resolve attempts before authentication succeeds',
);
requireIncludes(appSecurityTestPath, appSecurityTest, 'imports_protected');
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'keeps auth, catalog, mutation, sync, and provider search/import limits in separate buckets',
);
requireIncludes(appSecurityTestPath, appSecurityTest, "limiter: 'catalog'");
requireIncludes(appSecurityTestPath, appSecurityTest, "limiter: 'mutations'");

const authPath = 'apps/api/src/modules/auth/auth.controller.ts';
const auth = readRequired(authPath);
for (const [decorator, route] of [
  ['Get', 'me'],
  ['Patch', 'profile'],
  ['Get', 'data-export'],
  ['Get', 'account/deletion-preview'],
  ['Delete', 'account'],
  ['Get', 'sessions'],
  ['Delete', 'sessions/:sessionId'],
  ['Post', 'sessions/revoke-all'],
]) {
  requireRouteGuard(authPath, auth, decorator, route);
}
for (const route of ['register', 'login']) {
  requirePattern(
    authPath,
    auth,
    new RegExp(`@Post\\('${route}'\\)[\\s\\S]{0,360}createLegacyAuthDisabledException`),
    `legacy ${route} route must remain disabled with 410 Gone.`,
  );
}
for (const route of ['google/start', 'google/status', 'google/callback']) {
  requireIncludes(authPath, auth, `@Get('${route}')`);
}
requireIncludes(authPath, auth, "@Post('refresh')");
requireIncludes(authPath, auth, "@Post('logout')");
requireIncludes(authPath, auth, 'REFRESH_TOKEN_COOKIE_NAME');
requireIncludes(authPath, auth, 'getRefreshTokenClearCookieOptions');

const metricsPath = 'apps/api/src/observability/metrics.controller.ts';
const metrics = readRequired(metricsPath);
requireIncludes(metricsPath, metrics, "@Controller('metrics')");
requireIncludes(metricsPath, metrics, 'canReadMetrics');
requireIncludes(metricsPath, metrics, 'NotFoundException');
requireIncludes(metricsPath, metrics, "@Header('Cache-Control', 'no-store')");

const healthPath = 'apps/api/src/modules/health/health.controller.ts';
const health = readRequired(healthPath);
for (const route of ['health', 'livez', 'readyz']) {
  requireIncludes(healthPath, health, `@Get('${route}')`);
}
if (health.includes('JwtAuthGuard') || health.includes('@UseGuards')) {
  failures.push(`${healthPath} must remain public for platform health checks.`);
}

const imageProxyPath = 'apps/api/src/modules/image-proxy/image-proxy.controller.ts';
const imageProxy = readRequired(imageProxyPath);
requireIncludes(imageProxyPath, imageProxy, "@Controller('image-proxy')");
requireIncludes(imageProxyPath, imageProxy, '@Get()');
requireIncludes(imageProxyPath, imageProxy, 'imageProxyService.getImage(url)');
if (imageProxy.includes('JwtAuthGuard') || imageProxy.includes('@UseGuards')) {
  failures.push(`${imageProxyPath} must remain public and policy-bounded for cached cover images.`);
}

for (const path of expectedControllers) {
  requireIncludes(authSurfacePath, authSurface, path);
}
for (const phrase of [
  'protected by `JwtAuthGuard`',
  'optional bearer',
  'public platform health',
  'metrics bearer token',
  'policy-bounded public image proxy',
  'npm run qa:api-auth-surface',
]) {
  requireIncludes(authSurfacePath, authSurface, phrase);
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:api-auth-surface":\s*"node scripts\/qa\/validate-api-auth-surface\.mjs"/,
  'package.json must expose qa:api-auth-surface.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-api-auth-surface\.mjs/,
  'commercial repository gates must syntax-check API auth surface validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:api-auth-surface/,
  'commercial repository gates must run qa:api-auth-surface.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:api-auth-surface');

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:api-auth-surface');
  requireIncludes(path, content, 'API authorization surface');
}

if (failures.length > 0) {
  console.error('API authorization surface check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('API authorization surface check passed.');
