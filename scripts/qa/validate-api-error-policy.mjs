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

const filterPath = 'apps/api/src/security/api-exception-filter.ts';
const configureAppPath = 'apps/api/src/configure-app.ts';
const securityAuditPath = 'apps/api/src/security/security-audit.service.ts';
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const healthControllerPath =
  'apps/api/src/modules/health/health.controller.ts';
const notionServicePath = 'apps/api/src/modules/notion/notion.service.ts';
const apiExceptionFilterTestPath = 'apps/api/test/api-exception-filter.spec.ts';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const healthControllerTestPath = 'apps/api/test/health.controller.spec.ts';
const notionServiceTestPath = 'apps/api/test/notion.service.spec.ts';
const policyPath = 'docs/security/API_ERROR_POLICY.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const runbookPath = 'docs/operations/RUNBOOK.md';
const smokeTestPath = 'docs/operations/deployment/PRODUCTION_SMOKE_TEST.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';

const filter = readRequired(filterPath);
const configureApp = readRequired(configureAppPath);
const securityAudit = readRequired(securityAuditPath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const healthController = readRequired(healthControllerPath);
const notionService = readRequired(notionServicePath);
const apiExceptionFilterTest = readRequired(apiExceptionFilterTestPath);
const appSecurityTest = readRequired(appSecurityTestPath);
const healthControllerTest = readRequired(healthControllerTestPath);
const notionServiceTest = readRequired(notionServiceTestPath);
const policy = readRequired(policyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const runbook = readRequired(runbookPath);
const smokeTest = readRequired(smokeTestPath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);

for (const phrase of [
  '@Catch()',
  'class ApiExceptionFilter',
  'getRequestId(request)',
  'GENERIC_INTERNAL_ERROR_MESSAGE',
  'Internal server error.',
  'withoutStack',
  'this.logger.error',
  'getRequestPathname',
  'getExceptionType',
  'api.exception.unhandled',
  'JSON.stringify',
]) {
  requireIncludes(filterPath, filter, phrase);
}
for (const forbidden of [
  'Unhandled API exception requestId=',
  'sanitizeExceptionTrace',
  'exception.stack',
]) {
  if (filter.includes(forbidden)) {
    failures.push(`${filterPath} must not include "${forbidden}".`);
  }
}

requireIncludes(
  configureAppPath,
  configureApp,
  "import { ApiExceptionFilter } from './security/api-exception-filter'",
);
requireIncludes(
  configureAppPath,
  configureApp,
  'app.useGlobalFilters(new ApiExceptionFilter())',
);
requireIncludes(configureAppPath, configureApp, 'createBodyParserErrorHandler');
requireIncludes(
  configureAppPath,
  configureApp,
  'app.use(createBodyParserErrorHandler(securityAudit))',
);
for (const phrase of [
  'createBodyParserErrorHandler',
  'createApiContentTypeGuard',
  'sendSecurityJsonError',
  'normalizeBodyParserError',
  'Malformed request body.',
  'Request body is too large.',
  'Unsupported request body media type.',
  'Request target is too long.',
  'Cross-site unsafe requests are not allowed.',
  'Origin is not allowed.',
  'Required client header is missing.',
  'Too Many Requests',
  'http.request_body_rejected',
  'http.unsupported_media_type',
]) {
  requireIncludes(securityMiddlewarePath, securityMiddleware, phrase);
}
requireIncludes(securityAuditPath, securityAudit, "'http.request_body_rejected'");
requireIncludes(securityAuditPath, securityAudit, "'http.unsupported_media_type'");

for (const phrase of [
  'type ReadinessFailureResponse',
  'requestId: string | null',
  'const requestId = getRequestId(request)',
  'throw new ServiceUnavailableException(response)',
]) {
  requireIncludes(healthControllerPath, healthController, phrase);
}

for (const phrase of [
  'NOTION_CONNECTION_TEST_FAILURE_MESSAGE',
  'NOTION_PAGE_SYNC_FAILURE_MESSAGE',
  'NOTION_PREVIEW_FAILURE_MESSAGE',
  'NOTION_APPLY_FAILURE_MESSAGE',
]) {
  requireIncludes(notionServicePath, notionService, phrase);
}
if (notionService.includes('error.message')) {
  failures.push(
    `${notionServicePath} must not return raw provider error.message values in API responses.`,
  );
}

for (const phrase of [
  'API error responses',
  'adds request ids to expected HTTP exception responses',
  'returns sanitized JSON for malformed request bodies before validation',
  'returns sanitized JSON for oversized request bodies before validation',
  'rejects unsupported request body media types before validation',
  'rejects overlong request targets before controller handling without echoing query data',
  'blocks authenticated unsafe requests with a missing client header in enforce mode',
  'applies a global limiter across API routes before route-specific limits',
  'sanitizes unhandled runtime errors without leaking stack details',
  'req_expected_error_1',
  'req_malformed_body_1',
  'req_large_body_1',
  'req_unsupported_media_1',
  'req_long_target_1',
  'req_client_header_missing_1',
  'req_global_rate_limit_1',
  'req_runtime_error_1',
  "message: 'Internal server error.'",
  "not.toContain('database password')",
  "not.toContain('stack')",
]) {
  requireIncludes(appSecurityTestPath, appSecurityTest, phrase);
}
for (const phrase of [
  'logs unhandled exceptions without raw messages, stack traces, or URL secrets',
  'req-unhandled-1',
  'api.exception.unhandled',
  'DATABASE_URL',
  'oauth-code',
]) {
  requireIncludes(apiExceptionFilterTestPath, apiExceptionFilterTest, phrase);
}
for (const phrase of [
  'records readiness failure request ids for operator correlation',
  'req-readyz-1',
  'getResponse()',
  "requestId: 'req-readyz-1'",
  "checks: ['postgres']",
]) {
  requireIncludes(healthControllerTestPath, healthControllerTest, phrase);
}

for (const phrase of [
  'does not return raw provider or database errors from apply failures',
  'Notion 변경사항 적용에 실패했습니다.',
  'raw notion payload',
]) {
  requireIncludes(notionServiceTestPath, notionServiceTest, phrase);
}
requirePattern(
  notionServiceTestPath,
  notionServiceTest,
  /DATABASE_URL\|postgresql:\\\/\\\/secret\|access_token\|raw notion payload/,
  'Notion API response regression test must assert raw provider/database errors are absent.',
);

for (const phrase of [
  'ApiExceptionFilter',
  'Feature-level provider errors',
  'Known `HttpException` responses',
  'Unexpected runtime exceptions',
  'requestId',
  'Internal server error.',
  'stack traces',
  'npm run qa:api-error-policy',
]) {
  requireIncludes(policyPath, policy, phrase);
}

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:api-error-policy');
}
for (const [path, content] of [
  [runbookPath, runbook],
  [smokeTestPath, smokeTest],
]) {
  requireIncludes(path, content, '/readyz');
  requireIncludes(path, content, 'requestId');
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:api-error-policy":\s*"node scripts\/qa\/validate-api-error-policy\.mjs"/,
  'package.json must expose qa:api-error-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-api-error-policy\.mjs/,
  'commercial repository gates must syntax-check API error policy validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:api-error-policy/,
  'commercial repository gates must run qa:api-error-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node syntax: API error policy validator/,
  'Gate 1 local evidence helper must syntax-check API error policy validation.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:api-error-policy');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:api-error-policy');

if (failures.length > 0) {
  console.error('API error policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('API error policy check passed.');
