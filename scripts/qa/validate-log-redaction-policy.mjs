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

const appModulePath = 'apps/api/src/app.module.ts';
const mainPath = 'apps/api/src/main.ts';
const prismaServicePath = 'apps/api/src/prisma/prisma.service.ts';
const legacyGenreMigrationPath =
  'apps/api/src/operations/migrate-legacy-genres-to-tags.ts';
const retentionCleanupPath = 'apps/api/src/operations/retention-cleanup.ts';
const importProviderCircuitClearPath =
  'apps/api/src/operations/import-provider-circuit-clear.ts';
const apiExceptionFilterPath = 'apps/api/src/security/api-exception-filter.ts';
const auditServicePath = 'apps/api/src/security/security-audit.service.ts';
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const authServicePath = 'apps/api/src/modules/auth/auth.service.ts';
const googleOAuthClientPath =
  'apps/api/src/modules/auth/google-oauth-client.ts';
const oauthFlowStorePath =
  'apps/api/src/modules/auth/google-oauth-flow-store.service.ts';
const worksServicePath = 'apps/api/src/modules/works/works.service.ts';
const providerRuntimeStatePath =
  'apps/api/src/modules/imports/runtime/provider-runtime-state.service.ts';
const imageProxyServicePath =
  'apps/api/src/modules/image-proxy/image-proxy.service.ts';
const syncPushServicePath =
  'apps/api/src/modules/sync/services/sync-push.service.ts';
const syncPullServicePath =
  'apps/api/src/modules/sync/services/sync-pull.service.ts';
const syncUtilsPath =
  'apps/api/src/modules/sync/services/sync-service-utils.ts';
const prodLogsPath = 'scripts/deploy/prod-logs.sh';
const httpLogTestPath = 'apps/api/test/http-log-redaction.spec.ts';
const apiExceptionFilterTestPath = 'apps/api/test/api-exception-filter.spec.ts';
const auditTestPath = 'apps/api/test/security-audit.service.spec.ts';
const authServiceTestPath = 'apps/api/test/auth.service.spec.ts';
const prismaServiceTestPath = 'apps/api/test/prisma.service.spec.ts';
const legacyGenreMigrationTestPath =
  'apps/api/test/migrate-legacy-genres-to-tags.spec.ts';
const retentionCleanupTestPath = 'apps/api/test/retention-cleanup.spec.ts';
const importProviderCircuitClearTestPath =
  'apps/api/test/import-provider-circuit-clear.spec.ts';
const rateLimitShutdownTestPath =
  'apps/api/test/security-rate-limit-shutdown.spec.ts';
const imageProxyTestPath = 'apps/api/test/image-proxy.service.spec.ts';
const worksServiceTestPath = 'apps/api/test/works.service.spec.ts';
const syncServiceTestPath = 'apps/api/test/sync.service.spec.ts';
const productionConfigTestPath = 'apps/api/test/production-config.spec.ts';
const logPolicyPath = 'docs/security/LOG_REDACTION_POLICY.md';
const securityChecklistPath = 'docs/security/SECURITY_CHECKLIST.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';

const appModule = readRequired(appModulePath);
const main = readRequired(mainPath);
const prismaService = readRequired(prismaServicePath);
const legacyGenreMigration = readRequired(legacyGenreMigrationPath);
const retentionCleanup = readRequired(retentionCleanupPath);
const importProviderCircuitClear = readRequired(importProviderCircuitClearPath);
const apiExceptionFilter = readRequired(apiExceptionFilterPath);
const auditService = readRequired(auditServicePath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const authService = readRequired(authServicePath);
const googleOAuthClient = readRequired(googleOAuthClientPath);
const oauthFlowStore = readRequired(oauthFlowStorePath);
const worksService = readRequired(worksServicePath);
const providerRuntimeState = readRequired(providerRuntimeStatePath);
const imageProxyService = readRequired(imageProxyServicePath);
const syncPushService = readRequired(syncPushServicePath);
const syncPullService = readRequired(syncPullServicePath);
const syncUtils = readRequired(syncUtilsPath);
const prodLogs = readRequired(prodLogsPath);
const httpLogTest = readRequired(httpLogTestPath);
const apiExceptionFilterTest = readRequired(apiExceptionFilterTestPath);
const auditTest = readRequired(auditTestPath);
const authServiceTest = readRequired(authServiceTestPath);
const prismaServiceTest = readRequired(prismaServiceTestPath);
const legacyGenreMigrationTest = readRequired(legacyGenreMigrationTestPath);
const retentionCleanupTest = readRequired(retentionCleanupTestPath);
const importProviderCircuitClearTest = readRequired(
  importProviderCircuitClearTestPath,
);
const rateLimitShutdownTest = readRequired(rateLimitShutdownTestPath);
const imageProxyTest = readRequired(imageProxyTestPath);
const worksServiceTest = readRequired(worksServiceTestPath);
const syncServiceTest = readRequired(syncServiceTestPath);
const productionConfigTest = readRequired(productionConfigTestPath);
const logPolicy = readRequired(logPolicyPath);
const securityChecklist = readRequired(securityChecklistPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);

for (const path of [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
]) {
  requireIncludes(appModulePath, appModule, path);
}
requireIncludes(appModulePath, appModule, 'serializers:');
requireIncludes(appModulePath, appModule, 'req: serializeRequestForLog');
requireIncludes(appModulePath, appModule, 'sanitizeRequestUrlForLog');
requirePattern(
  appModulePath,
  appModule,
  /return new URL\(value,\s*'https:\/\/work-archive\.local'\)\.pathname/,
  'request URL sanitizer must strip relative URL query strings and fragments.',
);
requirePattern(
  appModulePath,
  appModule,
  /return new URL\(value\)\.pathname/,
  'request URL sanitizer must strip absolute URL query strings and fragments.',
);

for (const needle of [
  'api.bootstrap.failed',
  'describeBootstrapError(error)',
  'JSON.stringify',
]) {
  requireIncludes(mainPath, main, needle);
}
for (const forbidden of ['error.stack', 'API failed to start. Check PORT']) {
  if (main.includes(forbidden)) {
    failures.push(`${mainPath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'postgres.connect.failed',
  'describePrismaStartupError(error)',
  'JSON.stringify',
]) {
  requireIncludes(prismaServicePath, prismaService, needle);
}
for (const forbidden of ['error.stack', 'Failed to connect to PostgreSQL. Check DATABASE_URL']) {
  if (prismaService.includes(forbidden)) {
    failures.push(`${prismaServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'formatLegacyGenreMigrationFailure(error)',
  'operations.migrate_legacy_genres_to_tags.failed',
]) {
  requireIncludes(legacyGenreMigrationPath, legacyGenreMigration, needle);
}
for (const forbidden of ['message: error instanceof Error ? error.message', 'Unknown error']) {
  if (legacyGenreMigration.includes(forbidden)) {
    failures.push(
      `${legacyGenreMigrationPath} must not include "${forbidden}".`,
    );
  }
}
for (const needle of [
  'logs startup connection failures without stack traces or database URLs',
  'postgres.connect.failed',
  'DATABASE_URL=postgresql://secret',
]) {
  requireIncludes(prismaServiceTestPath, prismaServiceTest, needle);
}
for (const needle of [
  'formats operation failures without raw database errors',
  'operations.migrate_legacy_genres_to_tags.failed',
  'DATABASE_URL=postgresql://secret',
]) {
  requireIncludes(
    legacyGenreMigrationTestPath,
    legacyGenreMigrationTest,
    needle,
  );
}
for (const [path, content, formatter, event] of [
  [
    retentionCleanupPath,
    retentionCleanup,
    'formatRetentionCleanupFailure(error)',
    'operations.retention_cleanup.failed',
  ],
  [
    importProviderCircuitClearPath,
    importProviderCircuitClear,
    'formatImportProviderCircuitClearFailure(error)',
    'operations.import_provider_circuit.clear_failed',
  ],
]) {
  requireIncludes(path, content, formatter);
  requireIncludes(path, content, event);

  for (const forbidden of ['message: ', 'error.message', 'String(error)']) {
    if (content.includes(forbidden)) {
      failures.push(`${path} must not include "${forbidden}".`);
    }
  }
}
for (const needle of [
  'formats operation failures without raw database errors',
  'operations.retention_cleanup.failed',
  'DATABASE_URL=postgresql://secret',
]) {
  requireIncludes(retentionCleanupTestPath, retentionCleanupTest, needle);
}
for (const needle of [
  'formats operation failures without raw Redis or token errors',
  'operations.import_provider_circuit.clear_failed',
  'REDIS_URL=redis://:secret',
]) {
  requireIncludes(
    importProviderCircuitClearTestPath,
    importProviderCircuitClearTest,
    needle,
  );
}

for (const needle of [
  'isSensitiveMetadataKey',
  'authorization|api[-_]?key|cookie|email|password|secret|token',
  'SENSITIVE_INLINE_VALUE_PATTERN',
  'authorization_code',
  'oauth_code',
  'provider_account_id',
  'set_cookie',
  "replace(/\\bBearer\\s+\\S+/gi, 'Bearer [redacted]')",
  "replace(/\\bBasic\\s+\\S+/gi, 'Basic [redacted]')",
  ".replace(SENSITIVE_INLINE_VALUE_PATTERN, '$1[redacted]')",
  'removeUrlQueryAndFragment',
  'MAX_SECURITY_METADATA_STRING_LENGTH = 160',
]) {
  requireIncludes(auditServicePath, auditService, needle);
}
for (const needle of [
  'security_audit.store_failed',
  'errorCode: this.describeOperationalError(error)',
  'requestId',
  'JSON.stringify',
]) {
  requireIncludes(auditServicePath, auditService, needle);
}
for (const forbidden of ['Security audit event was not stored', 'error.message']) {
  if (auditService.includes(forbidden)) {
    failures.push(`${auditServicePath} must not include "${forbidden}".`);
  }
}

for (const needle of [
  'drops query strings and fragments from logged request URLs',
  '/api/auth/google/callback?code=oauth-code',
  "url: '/api/auth/google/callback'",
]) {
  requireIncludes(httpLogTestPath, httpLogTest, needle);
}
for (const needle of [
  'api.exception.unhandled',
  'errorCode: getExceptionType(exception)',
  'path: getRequestPathname',
  'requestId: requestId ?? null',
  'JSON.stringify',
]) {
  requireIncludes(apiExceptionFilterPath, apiExceptionFilter, needle);
}
for (const forbidden of [
  'Unhandled API exception requestId=',
  'sanitizeExceptionTrace',
  'exception.stack',
]) {
  if (apiExceptionFilter.includes(forbidden)) {
    failures.push(`${apiExceptionFilterPath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'logs unhandled exceptions without raw messages, stack traces, or URL secrets',
  'api.exception.unhandled',
  'req-unhandled-1',
  'DATABASE_URL',
  'oauth-code',
]) {
  requireIncludes(apiExceptionFilterTestPath, apiExceptionFilterTest, needle);
}
for (const forbiddenAssertion of [
  "not.toContain('DATABASE_URL')",
  "not.toContain('postgresql://secret')",
  "not.toContain('access_token')",
  "not.toContain('raw payload')",
  "not.toContain('oauth-code')",
  "not.toContain('oauth-state')",
]) {
  requireIncludes(apiExceptionFilterTestPath, apiExceptionFilterTest, forbiddenAssertion);
}
for (const needle of [
  'sanitizes metadata string values before storing security events',
  'callbackUrl: \'/api/auth/google/callback?code=oauth-code#fragment\'',
  'code=[redacted]',
  'oauth_code=[redacted]',
  'drops sensitive OAuth and session metadata keys without dropping bounded error codes',
  'providerAccountId: \'provider-account-id-secret\'',
  'errorCode: \'invalid_oauth_state\'',
  'logs security audit storage failures without raw database errors',
  'security_audit.store_failed',
]) {
  requireIncludes(auditTestPath, auditTest, needle);
}
for (const needle of [
  'Bearer \\[redacted\\]',
  'state=\\[redacted\\]',
  'id_token=\\[redacted\\]',
]) {
  requireIncludes(auditTestPath, auditTest, needle);
}
requirePattern(
  auditTestPath,
  auditTest,
  /DATABASE_URL\|postgresql:\\\/\\\/secret\|access_token\|raw audit payload/,
  'security audit storage failure regression test must assert raw database errors are absent.',
);

for (const [path, content, event] of [
  [
    securityMiddlewarePath,
    securityMiddleware,
    'rate_limit.redis_store_unavailable',
  ],
  [
    oauthFlowStorePath,
    oauthFlowStore,
    'auth.google_oauth_flow.redis_unavailable',
  ],
  [
    providerRuntimeStatePath,
    providerRuntimeState,
    'import_provider.redis_state_unavailable',
  ],
]) {
  requireIncludes(path, content, event);
  requireIncludes(path, content, 'describeOperationalError(error)');
  requireIncludes(path, content, 'JSON.stringify');
  if (content.includes('error.message') || content.includes('String(error)')) {
    failures.push(
      `${path} must use bounded error names for operational fallback logs.`,
    );
  }
}

for (const needle of [
  'auth.refresh.failed',
  'auth.refresh.reuse_detected',
  "entityType: 'refresh_session'",
  'requestId: metadata.requestId ?? null',
  'JSON.stringify',
]) {
  requireIncludes(authServicePath, authService, needle);
}
for (const forbidden of ['Refresh failed reason=', 'refresh_token=']) {
  if (authService.includes(forbidden)) {
    failures.push(`${authServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'auth.google.token_exchange.failed',
  'auth.google.token_exchange.invalid_body',
  'auth.google.jwks.stale_cache_used',
  'describeExternalFetchError(error)',
  'GOOGLE_AUTH_PROVIDER',
  'JSON.stringify',
]) {
  requireIncludes(googleOAuthClientPath, googleOAuthClient, needle);
}
for (const forbidden of [
  'Google token exchange failed reason=',
  'Google token exchange failed status=',
  'Google token exchange returned invalid body reason=',
  'Google signing keys fetch failed; using stale cache reason=',
  'Google signing keys returned status=',
  'Google signing keys body invalid; using stale cache',
]) {
  if (googleOAuthClient.includes(forbidden)) {
    failures.push(`${googleOAuthClientPath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'logs non-production Redis rate-limit fallback without raw Redis errors',
  'rate_limit.redis_store_unavailable',
  'redis:\\/\\/:secret|access_token|raw payload',
]) {
  requireIncludes(rateLimitShutdownTestPath, rateLimitShutdownTest, needle);
}
for (const needle of [
  'auth.google.token_exchange.failed',
  'auth.google.jwks.stale_cache_used',
  'oauth-code-secret',
  'logs refresh failures as structured events without raw refresh tokens',
  'auth.refresh.failed',
  'raw-refresh-token-secret',
]) {
  requireIncludes(authServiceTestPath, authServiceTest, needle);
}

for (const needle of [
  'image_proxy.fetch_failed',
  'host: url.hostname',
  'describeOperationalError(error)',
  'JSON.stringify',
]) {
  requireIncludes(imageProxyServicePath, imageProxyService, needle);
}
for (const forbidden of [
  'this.logger.warn({',
  'url: url.toString()',
  'href: url.href',
]) {
  if (imageProxyService.includes(forbidden)) {
    failures.push(`${imageProxyServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'logs only the image provider host and safe error code on upstream failures',
  'image_proxy.fetch_failed',
  'secret-token',
  "not.toContain('/books/content')",
]) {
  requireIncludes(imageProxyTestPath, imageProxyTest, needle);
}

for (const needle of [
  'work.mutation.failed',
  'errorCode',
  'requestId: requestId ?? null',
  'JSON.stringify',
]) {
  requireIncludes(worksServicePath, worksService, needle);
}
requirePattern(
  worksServicePath,
  worksService,
  /const errorName = error instanceof Error \? error\.name : 'UnknownError';/,
  'work mutation logs must record bounded error names instead of raw exception text.',
);
for (const forbidden of ['error.message', 'reason=${errorName}']) {
  if (worksService.includes(forbidden)) {
    failures.push(`${worksServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of [
  'logs work mutation failures with request ids and without raw error text',
  'req-work-1',
  'work.mutation.failed',
]) {
  requireIncludes(worksServiceTestPath, worksServiceTest, needle);
}
requirePattern(
  worksServiceTestPath,
  worksServiceTest,
  /DATABASE_URL\|postgresql:\\\/\\\/secret\|access_token\|raw payload/,
  'work mutation log regression test must assert raw secret-like error text is absent.',
);

for (const needle of [
  'sync.push.failed',
  'sync.change.failed',
  'entityId: change.entityId',
  'operation: change.operation',
  'queueId: change.queueId',
  'requestId',
]) {
  requireIncludes(syncPushServicePath, syncPushService, needle);
}
for (const forbidden of [
  'Sync push failed userId=',
  'Sync change failed userId=',
  'reason=${describeError(error)}',
]) {
  if (syncPushService.includes(forbidden)) {
    failures.push(`${syncPushServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of ['sync.pull.failed', 'requestId']) {
  requireIncludes(syncPullServicePath, syncPullService, needle);
}
for (const forbidden of [
  'Sync pull failed userId=',
  'reason=${describeError(error)}',
]) {
  if (syncPullService.includes(forbidden)) {
    failures.push(`${syncPullServicePath} must not include "${forbidden}".`);
  }
}
for (const needle of ['entityId', 'operation', 'queueId', 'errorCode']) {
  requireIncludes(syncUtilsPath, syncUtils, needle);
}
for (const needle of [
  'logs sync.change.failed without sensitive request or token material',
  'req-sync-redaction',
  'queueId: \'bd0ce1c4-c9f1-4d05-8204-079722e0e53b\'',
  'raw_image_data',
]) {
  requireIncludes(syncServiceTestPath, syncServiceTest, needle);
}
requirePattern(
  syncServiceTestPath,
  syncServiceTest,
  /authorization\|cookie\|set-cookie\|refresh_token\|access_token\|oauth_code\|api_key\|raw_image_data/,
  'sync log regression test must assert sensitive request and token material is absent.',
);

for (const needle of [
  'redact_output()',
  'DATABASE_URL|REDIS_URL',
  'Bearer )[A-Za-z0-9._~+\\/=-]+',
  'Basic )[A-Za-z0-9._~+\\/=-]+',
  'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
  '([^[:space:]&;,]+)',
  'PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs',
  '| redact_output',
]) {
  requireIncludes(prodLogsPath, prodLogs, needle);
}
for (const needle of [
  'redacts sensitive production log output by default',
  'requires explicit confirmation before printing raw production logs',
  'raw-session-token',
  'id_token=raw-id-token',
  'refresh_token=raw-refresh-token',
  'oauth_code=raw-oauth-code',
  'credential=raw-inline-credential',
  'raw-inline-id-token',
]) {
  requireIncludes(productionConfigTestPath, productionConfigTest, needle);
}

for (const phrase of [
  'HTTP request log redaction',
  'security audit metadata',
  'Structured Application Logs',
  'Operator Log Retrieval',
  'Authentication failure logs',
  'Startup and operation failure logs',
  'Image proxy failure logs',
  'Operational fallback logs',
  'Sync failure logs',
  'Work mutation failure logs',
  'OAuth authorization codes',
  'inline sensitive key-value pairs',
  'provider account ID',
  'npm run qa:log-redaction-policy',
]) {
  requireIncludes(logPolicyPath, logPolicy, phrase);
}
requireIncludes(securityChecklistPath, securityChecklist, 'Structured logs redact');
requireIncludes(securityChecklistPath, securityChecklist, 'Production log review uses `npm run ops:logs`');

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:log-redaction-policy');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:log-redaction-policy":\s*"node scripts\/qa\/validate-log-redaction-policy\.mjs"/,
  'package.json must expose qa:log-redaction-policy.',
);
requirePattern(
  packagePath,
  packageJson,
  /"ops:logs":\s*"scripts\/deploy\/prod-logs\.sh"/,
  'package.json must expose ops:logs.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-log-redaction-policy\.mjs/,
  'commercial repository gates must syntax-check log redaction policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:log-redaction-policy/,
  'commercial repository gates must run qa:log-redaction-policy.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:log-redaction-policy');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:log-redaction-policy');

if (failures.length > 0) {
  console.error('Log redaction policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Log redaction policy check passed.');
