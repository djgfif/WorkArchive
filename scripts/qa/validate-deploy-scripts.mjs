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

const shellScripts = [
  'scripts/deploy/beta-preflight.sh',
  'scripts/deploy/beta-smoke.sh',
  'scripts/deploy/commercial-beta-rehearsal.sh',
  'scripts/deploy/prod-build.sh',
  'scripts/deploy/prod-up.sh',
  'scripts/deploy/prod-down.sh',
  'scripts/deploy/prod-healthcheck.sh',
  'scripts/deploy/prod-logs.sh',
  'scripts/deploy/prod-backup.sh',
  'scripts/deploy/prod-backup-verify.sh',
  'scripts/deploy/prod-restore-drill.sh',
];

const scriptContents = new Map(
  shellScripts.map((path) => [path, readRequired(path)]),
);
const packagePath = 'package.json';
const nginxPath = 'apps/web/nginx.conf';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';
const gate1ValidatorSelfTestPath =
  'scripts/qa/validate-gate1-evidence.self-test.mjs';
const gate1MissingEvidencePath =
  'scripts/qa/gate1-missing-evidence-report.mjs';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';
const runbookPath = 'docs/commercial/GATE_1_VALIDATION_RUNBOOK.md';
const commercialEnvPreflightPath =
  'scripts/deploy/commercial-env-preflight.mjs';
const apiRuntimeConfigPath = 'apps/api/src/config/api-runtime-config.ts';
const apiRuntimeConfigTestPath = 'apps/api/test/api-runtime-config.spec.ts';
const composeProdPath = 'compose.prod.yml';
const productionConfigTestPath = 'apps/api/test/production-config.spec.ts';
const dockerRuntimePreflightSelfTestPath =
  'scripts/qa/docker-runtime-preflight.self-test.mjs';
const qaEvidenceScriptPaths = [
  'scripts/qa/docker-runtime-preflight.mjs',
  'scripts/qa/import-search-qa.mjs',
  'scripts/qa/monitoring-evidence.mjs',
  'scripts/qa/performance-smoke.mjs',
  'scripts/qa/sync-load-smoke.mjs',
];

const packageJson = readRequired(packagePath);
const nginx = readRequired(nginxPath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);
const gate1ValidatorSelfTest = readRequired(gate1ValidatorSelfTestPath);
const gate1MissingEvidence = readRequired(gate1MissingEvidencePath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);
const runbook = readRequired(runbookPath);
const commercialEnvPreflight = readRequired(commercialEnvPreflightPath);
const apiRuntimeConfig = readRequired(apiRuntimeConfigPath);
const apiRuntimeConfigTest = readRequired(apiRuntimeConfigTestPath);
const composeProd = readRequired(composeProdPath);
const productionConfigTest = readRequired(productionConfigTestPath);
const dockerRuntimePreflightSelfTest = readRequired(
  dockerRuntimePreflightSelfTestPath,
);
const qaEvidenceScripts = new Map(
  qaEvidenceScriptPaths.map((path) => [path, readRequired(path)]),
);

for (const [path, content] of scriptContents) {
  requireIncludes(path, content, '#!/usr/bin/env bash');
  requirePattern(
    path,
    content,
    /set -E?euo pipefail|set -euo pipefail/,
    'deployment shell scripts must use strict shell mode.',
  );
  requireIncludes(gatesPath, gates, `bash -n ${path}`);
  requireIncludes(localEvidencePath, localEvidence, `bash -n ${path}`);
}

const betaSmoke = scriptContents.get('scripts/deploy/beta-smoke.sh') ?? '';
for (const needle of [
  'expect_status GET /health 200',
  'redact_output()',
  'redact_text()',
  'Running beta smoke tests against $(redact_text "$BASE_URL")',
  '2>"$error_file"',
  'redact_output <"$error_file" >&2',
  `sed -n '1,20p' "$body_file" | redact_output`,
  'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
  '([^[:space:]&;,]+)',
  'expect_status GET /livez 200',
  'expect_status GET /readyz 200',
  'data.checks && data.checks.config === "ok"',
  "header_contains '^cache-control:.*no-store'",
  'assert_api_security_headers "/health"',
  'assert_api_security_headers "/livez"',
  'assert_api_security_headers "/readyz"',
  'assert_api_security_headers "/api/auth/google/status"',
  'expect_status GET /api/auth/google/status 200',
  'expect_status GET "/api/auth/google/start?return_origin=${ALLOWED_ORIGIN}" 302',
  "header_contains '^set-cookie:.*wa_google_oauth_flow='",
  "header_contains '^set-cookie:.*httponly'",
  "header_contains '^set-cookie:.*secure'",
  "header_contains '^set-cookie:.*samesite=lax'",
  "header_contains '^set-cookie:.*path=/api/auth/google'",
  "header_absent '^set-cookie:.*wa_google_oauth_state='",
  "header_absent '^set-cookie:.*wa_google_oauth_nonce='",
  'expect_status POST /api/auth/refresh',
  'expect_status GET /metrics 404',
  'run_operator_sync_smoke',
  '-H "X-Work-Archive-Client: web"',
  'run_container_fs_smoke',
]) {
  requireIncludes('scripts/deploy/beta-smoke.sh', betaSmoke, needle);
}

const prodHealthcheck =
  scriptContents.get('scripts/deploy/prod-healthcheck.sh') ?? '';
for (const needle of [
  'endpoints=(/health /livez /readyz)',
  'redact_output()',
  'redact_text()',
  'assert_health_json',
  'did not report ${check}=ok',
  'assert_no_store_header',
  'Checking production health endpoints at $(redact_text "$BASE_URL")',
  '2>"$error_file"',
  'redact_output <"$error_file" >&2',
  'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
  '([^[:space:]&;,]+)',
  "curl -sS -D",
  'docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps',
]) {
  requireIncludes('scripts/deploy/prod-healthcheck.sh', prodHealthcheck, needle);
}

const prodLogs = scriptContents.get('scripts/deploy/prod-logs.sh') ?? '';
for (const needle of [
  'ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"',
  'COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"',
  'TAIL must be a positive integer.',
  '$name must be true or false.',
  'FOLLOW="$(normalize_bool FOLLOW "$FOLLOW")"',
  'RAW_LOGS="$(normalize_bool PROD_LOGS_RAW "$RAW_LOGS")"',
  'redact_output()',
  'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
  '([^[:space:]&;,]+)',
  'DATABASE_URL|REDIS_URL',
  'PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs',
  '| redact_output',
]) {
  requireIncludes('scripts/deploy/prod-logs.sh', prodLogs, needle);
}

for (const [location, upstream] of [
  ['/api/', 'http://api:3000/api/'],
  ['/health', 'http://api:3000/health'],
  ['/livez', 'http://api:3000/livez'],
  ['/readyz', 'http://api:3000/readyz'],
  ['/metrics', 'http://api:3000/metrics'],
]) {
  requireIncludes(nginxPath, nginx, `location ${location}`);
  requireIncludes(nginxPath, nginx, `proxy_pass ${upstream};`);
}

const betaRehearsal =
  scriptContents.get('scripts/deploy/commercial-beta-rehearsal.sh') ?? '';
for (const needle of [
  'beta-preflight.sh',
  'redact_output()',
  'docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config',
  '--profile release run --rm api-migrate 2>&1 | redact_output',
  'up -d --build 2>&1 | redact_output',
  'prod-healthcheck.sh',
  'HEALTHCHECK_BASE_URL="$BETA_BASE_URL"',
  'beta-smoke.sh',
  'BETA_BASE_URL="$BETA_BASE_URL"',
  'RETENTION_CLEANUP_DRY_RUN=true retention-cleanup 2>&1 | redact_output',
]) {
  requireIncludes('scripts/deploy/commercial-beta-rehearsal.sh', betaRehearsal, needle);
}

for (const [path, content] of [
  ['scripts/deploy/prod-build.sh', scriptContents.get('scripts/deploy/prod-build.sh') ?? ''],
  ['scripts/deploy/prod-up.sh', scriptContents.get('scripts/deploy/prod-up.sh') ?? ''],
  ['scripts/deploy/prod-down.sh', scriptContents.get('scripts/deploy/prod-down.sh') ?? ''],
]) {
  requireIncludes(path, content, 'ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"');
  requireIncludes(path, content, 'COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"');
  requireIncludes(path, content, 'redact_output()');
  requireIncludes(path, content, 'printf \'%s\\n\' "$1" | redact_output >&2');
  requireIncludes(path, content, 'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token');
  requireIncludes(path, content, '([^[:space:]&;,]+)');
  requireIncludes(path, content, 'DATABASE_URL|REDIS_URL');
  requireIncludes(path, content, 'docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE"');
}
for (const [path, content] of [
  ['scripts/deploy/prod-build.sh', scriptContents.get('scripts/deploy/prod-build.sh') ?? ''],
  ['scripts/deploy/prod-up.sh', scriptContents.get('scripts/deploy/prod-up.sh') ?? ''],
]) {
  requireIncludes(path, content, 'commercial-env-preflight.mjs');
}
requireIncludes('scripts/deploy/prod-build.sh', scriptContents.get('scripts/deploy/prod-build.sh') ?? '', 'build "$@" 2>&1 | redact_output');
requireIncludes('scripts/deploy/prod-up.sh', scriptContents.get('scripts/deploy/prod-up.sh') ?? '', 'up -d "$@" 2>&1 | redact_output');
requireIncludes('scripts/deploy/prod-up.sh', scriptContents.get('scripts/deploy/prod-up.sh') ?? '', 'ps 2>&1 | redact_output');
requireIncludes('scripts/deploy/prod-down.sh', scriptContents.get('scripts/deploy/prod-down.sh') ?? '', 'down "$@" 2>&1 | redact_output');

requirePattern(
  packagePath,
  packageJson,
  /"qa:deploy-scripts":\s*"node scripts\/qa\/validate-deploy-scripts\.mjs"/,
  'package.json must expose qa:deploy-scripts.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:docker-runtime":\s*"node scripts\/qa\/docker-runtime-preflight\.mjs"/,
  'package.json must expose qa:docker-runtime.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:docker-runtime:self-test":\s*"node scripts\/qa\/docker-runtime-preflight\.self-test\.mjs"/,
  'package.json must expose qa:docker-runtime:self-test.',
);
requirePattern(
  packagePath,
  packageJson,
  /"ops:logs":\s*"scripts\/deploy\/prod-logs\.sh"/,
  'package.json must expose ops:logs.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:gate1:missing":\s*"node scripts\/qa\/gate1-missing-evidence-report\.mjs"/,
  'package.json must expose qa:gate1:missing.',
);
requireIncludes(gatesPath, gates, 'node --check scripts/qa/validate-deploy-scripts.mjs');
requireIncludes(gatesPath, gates, 'node --check scripts/qa/validate-gate1-evidence.self-test.mjs');
requireIncludes(gatesPath, gates, 'node --check scripts/qa/gate1-missing-evidence-report.mjs');
requireIncludes(gatesPath, gates, 'node --check scripts/qa/docker-runtime-preflight.mjs');
requireIncludes(gatesPath, gates, 'node --check scripts/qa/docker-runtime-preflight.self-test.mjs');
requireIncludes(gatesPath, gates, 'npm run qa:deploy-scripts');
requireIncludes(gatesPath, gates, 'npm run qa:gate1:evidence:self-test');
requireIncludes(gatesPath, gates, 'npm run qa:gate1:missing');
requireIncludes(gatesPath, gates, 'npm run qa:docker-runtime:self-test');
requireIncludes(gatesPath, gates, 'npm run qa:docker-runtime');
requireIncludes(gatesPath, gates, 'npm run qa:import-search');
requireIncludes(gatesPath, gates, 'SYNC_LOAD_DRY_RUN=true npm run qa:sync-load');
requireIncludes(
  gatesPath,
  gates,
  'PERF_SMOKE_DRY_RUN=true npm run qa:performance-smoke',
);
requireIncludes(
  gatesPath,
  gates,
  'MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring',
);
requireIncludes(localEvidencePath, localEvidence, 'node --check scripts/qa/validate-deploy-scripts.mjs');
requireIncludes(localEvidencePath, localEvidence, 'node --check scripts/qa/gate1-missing-evidence-report.mjs');
requireIncludes(localEvidencePath, localEvidence, 'node --check scripts/qa/docker-runtime-preflight.mjs');
requireIncludes(localEvidencePath, localEvidence, 'node --check scripts/qa/docker-runtime-preflight.self-test.mjs');
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:deploy-scripts');
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:gate1:missing');
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:docker-runtime:self-test');
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:docker-runtime');
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:import-search');
requireIncludes(
  localEvidencePath,
  localEvidence,
  'env SYNC_LOAD_DRY_RUN=true npm run qa:sync-load',
);
requireIncludes(
  localEvidencePath,
  localEvidence,
  'env PERF_SMOKE_DRY_RUN=true npm run qa:performance-smoke',
);
requireIncludes(
  localEvidencePath,
  localEvidence,
  'env MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring',
);
requireIncludes(localEvidencePath, localEvidence, 'REPORT_DIR_INPUT="${GATE1_EVIDENCE_DIR:-$ROOT_DIR/tmp/gate1-evidence}"');
requireIncludes(localEvidencePath, localEvidence, 'REPORT_DIR="$ROOT_DIR/$REPORT_DIR_INPUT"');
requireIncludes(localEvidencePath, localEvidence, 'REDIS_URL');
requireIncludes(localEvidencePath, localEvidence, '(Basic )');
requireIncludes(localEvidencePath, localEvidence, '(rediss?://)');
requireIncludes(localEvidencePath, localEvidence, '(https?://)');
requireIncludes(
  localEvidencePath,
  localEvidence,
  'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
);
requireIncludes(localEvidencePath, localEvidence, '([^[:space:]&;,]+)');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:deploy-scripts');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:docker-runtime:self-test');
requireIncludes(
  gate1ValidatorPath,
  gate1Validator,
  'IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search',
);
requireIncludes(
  gate1ValidatorPath,
  gate1Validator,
  'SYNC_LOAD_DRY_RUN=false npm run qa:sync-load',
);
requireIncludes(
  gate1ValidatorPath,
  gate1Validator,
  'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime',
);
requireIncludes(gate1ValidatorPath, gate1Validator, 'function validateReportContent');
requireIncludes(gate1ValidatorPath, gate1Validator, 'overall PASS status');
requireIncludes(gate1ValidatorPath, gate1Validator, 'config-and-build mode');
requireIncludes(gate1ValidatorPath, gate1Validator, 'production image build PASS check');
requireIncludes(gate1ValidatorPath, gate1Validator, 'live provider quality PASS check');
requireIncludes(gate1ValidatorPath, gate1Validator, 'oversized push batch DTO rejection');
requireIncludes(gate1ValidatorPath, gate1Validator, 'dry-run mode marker');
requireIncludes(gate1ValidatorPath, gate1Validator, 'blocked scenario marker');
requireIncludes(gate1ValidatorPath, gate1Validator, 'function readBooleanEnv');
requireIncludes(gate1ValidatorPath, gate1Validator, 'must be true or false when set.');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'references missing report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'references empty report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'references symbolic link report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'references oversized report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'that appears to contain a bearer token');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'blocked docker runtime report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'offline import search report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'dry-run sync load report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'dry-run monitoring report');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'dry-run performance report');
requireIncludes(
  gate1ValidatorSelfTestPath,
  gate1ValidatorSelfTest,
  'without overall PASS status',
);
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, 'unsafe or non-workspace report path');
requireIncludes(gate1ValidatorSelfTestPath, gate1ValidatorSelfTest, "process.env.GATE1_EVIDENCE_STRICT = 'treu'");
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'runGate1EvidenceValidation');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Release Metadata And Approval');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Beta Host Preflight And Smoke');
requireIncludes(
  gate1MissingEvidencePath,
  gate1MissingEvidence,
  'Docker Runtime Release-Runner Evidence',
);
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Live Import/Search QA');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Live Sync Load QA');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Backup And Restore Drill');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'Smoke Performance Baseline');
requireIncludes(gate1MissingEvidencePath, gate1MissingEvidence, 'does not approve a release candidate');
requireIncludes(runbookPath, runbook, 'npm run qa:gate1:missing');
requireIncludes(commercialReadinessPath, commercialReadiness, 'gate1-missing-evidence-report.mjs');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, '/^[1-9]\\d*$/.test(actual)');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'must be a safe integer');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalPositiveInteger');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalPositiveIntegerMax');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'PRISMA_CONNECT_TIMEOUT_MS');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectLogLevel');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'LOG_LEVEL');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalPort');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalHost');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalNoWhitespace');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'expectOptionalClientHeaderGuardMode');
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, "expectBoolean('METRICS_INTERNAL_ACCESS_REVIEWED')");
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, "expectExact('VITE_API_BASE_URL', '/api')");
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects commercial env preflight when production web build points away from the API proxy',
);
requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, 'is defined more than once.');
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'validate_unique_env_keys',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects duplicate production env keys before deployment checks diverge',
);
requireIncludes(composeProdPath, composeProd, 'LOG_LEVEL: ${LOG_LEVEL:-info}');
requireIncludes(
  composeProdPath,
  composeProd,
  'METRICS_INTERNAL_ACCESS_REVIEWED: ${METRICS_INTERNAL_ACCESS_REVIEWED:-false}',
);
requireIncludes(productionConfigTestPath, productionConfigTest, 'LOG_LEVEL:');
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects unsupported commercial log levels in env preflight',
);
for (const developmentOnlyEnvName of ['PASSWORD_RESET_DEV_LINKS_ENABLED']) {
  requireIncludes(composeProdPath, composeProd, `${developmentOnlyEnvName}: 'false'`);
  requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, developmentOnlyEnvName);
  requireIncludes(apiRuntimeConfigPath, apiRuntimeConfig, developmentOnlyEnvName);
  requireIncludes(apiRuntimeConfigTestPath, apiRuntimeConfigTest, developmentOnlyEnvName);
  requireIncludes(
    'scripts/deploy/beta-preflight.sh',
    scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
    developmentOnlyEnvName,
  );
  requireIncludes(productionConfigTestPath, productionConfigTest, developmentOnlyEnvName);
}
for (const [path, content] of qaEvidenceScripts) {
  requireIncludes(path, content, '#!/usr/bin/env node');
  requireIncludes(path, content, 'function readBooleanEnv');
  requireIncludes(path, content, 'must be true or false when set.');
  requireIncludes(path, content, 'function redactUrlSecrets');
  requireIncludes(path, content, 'sensitiveUrlParamPattern');
  requireIncludes(path, content, 'sensitiveInlineValuePattern');
  requireIncludes(
    path,
    content,
    'access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token',
  );
  requireIncludes(path, content, "url.username = 'redacted'");
  requireIncludes(path, content, "url.password = 'redacted'");
  requireIncludes(path, content, "url.searchParams.set(key, '[REDACTED]')");

  if (content.includes('parseInt(') || content.includes('Number.parseInt(')) {
    failures.push(`${path} must use strict integer parsing instead of parseInt.`);
  }
}
requireIncludes(productionConfigTestPath, productionConfigTest, 'SYNC_LOAD_RECORDS:');
requireIncludes(productionConfigTestPath, productionConfigTest, 'PERF_SMOKE_ITERATIONS:');
requireIncludes(productionConfigTestPath, productionConfigTest, 'PERF_SMOKE_MAX_P95_MS:');
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'MONITORING_EVIDENCE_TIMEOUT_MS:',
);
requireIncludes(productionConfigTestPath, productionConfigTest, 'IMPORT_SEARCH_QA_TOP_N:');
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'redacts URL credentials and sensitive query values in performance smoke reports',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'redacts URL credentials and sensitive query values in beta smoke diagnostics',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'checks OAuth flow cookie attributes in beta smoke',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'redacts URL credentials and sensitive query values in production healthcheck diagnostics',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'redacts sensitive production log output by default',
);
for (const needle of [
  'id_token=raw-id-token',
  'nonce=raw-nonce',
  'refresh_token=raw-refresh-token',
  'oauth_code=raw-oauth-code',
  'credential=raw-inline-credential',
  'id_token=[REDACTED]',
  'nonce=[REDACTED]',
  'refresh_token=[REDACTED]',
  'oauth_code=[REDACTED]',
  'credential=[REDACTED]',
  'raw-inline-id-token',
  'raw-inline-refresh-token',
  'raw-inline-oauth-code',
  'raw-inline-nonce',
  'raw-inline-credential',
]) {
  requireIncludes(productionConfigTestPath, productionConfigTest, needle);
}
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'requires explicit confirmation before printing raw production logs',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'includes rate-limit header evidence fields in performance smoke reports',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'records optional latency budgets in performance smoke reports',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'fails performance smoke when the latency budget is exceeded',
);
requireIncludes(productionConfigTestPath, productionConfigTest, 'SYNC_LOAD_DRY_RUN:');
requireIncludes(
  'scripts/qa/sync-load-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/sync-load-smoke.mjs') ?? '',
  'oversizedPushSmokeStatus',
);
requireIncludes(
  runbookPath,
  runbook,
  'oversized `201`-change push batch smoke returns DTO validation `400`',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'PERF_SMOKE_REQUIRE_AUTHENTICATED:',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'MONITORING_EVIDENCE_REQUIRE_GRAFANA:',
);
requireIncludes(productionConfigTestPath, productionConfigTest, 'IMPORT_SEARCH_QA_LIVE:');
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'blocks live import search QA when only the browser /api proxy path is configured',
);
requireIncludes(
  'scripts/qa/import-search-qa.mjs',
  qaEvidenceScripts.get('scripts/qa/import-search-qa.mjs') ?? '',
  'VITE_API_BASE_URL=/api is only a browser build-time proxy path',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'baseUrl: redact(baseUrl)',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'function collectRateLimitHeaders',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'PERF_SMOKE_MAX_P95_MS',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'PERF_SMOKE_DRY_RUN_SAMPLE_MS',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'evaluateLatencyBudget',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'RateLimit headers',
);
requireIncludes(
  'scripts/qa/performance-smoke.mjs',
  qaEvidenceScripts.get('scripts/qa/performance-smoke.mjs') ?? '',
  'approved release budget',
);
requireIncludes(
  'scripts/qa/monitoring-evidence.mjs',
  qaEvidenceScripts.get('scripts/qa/monitoring-evidence.mjs') ?? '',
  'url: response.json?.meta?.url ? redact(response.json.meta.url) : null',
);
for (const importGuestEnvName of [
  'IMPORT_SERVER_SEARCH_GUEST_ENABLED',
  'IMPORT_SERVER_SEARCH_GUEST_APPROVED',
  'KOBIS_HTTP_PROVIDER_ENABLED',
]) {
  requireIncludes(composeProdPath, composeProd, importGuestEnvName);
  requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, importGuestEnvName);
  requireIncludes(apiRuntimeConfigPath, apiRuntimeConfig, importGuestEnvName);
  requireIncludes(apiRuntimeConfigTestPath, apiRuntimeConfigTest, importGuestEnvName);
  requireIncludes(
    'scripts/deploy/beta-preflight.sh',
    scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
    importGuestEnvName,
  );
  requireIncludes(productionConfigTestPath, productionConfigTest, importGuestEnvName);
}
for (const serverProviderEnvName of [
  'TMDB_API_READ_TOKEN',
  'TMDB_API_KEY',
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
  'KAKAO_REST_API_KEY',
  'KOBIS_API_KEY',
]) {
  requireIncludes(composeProdPath, composeProd, serverProviderEnvName);
  requireIncludes(productionConfigTestPath, productionConfigTest, serverProviderEnvName);
}
requireIncludes(
  commercialEnvPreflightPath,
  commercialEnvPreflight,
  'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
);
requireIncludes(
  apiRuntimeConfigPath,
  apiRuntimeConfig,
  'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
);
for (const [rateLimitEnvName, maxValue] of [
  ['AUTH_RATE_LIMIT_MAX', '300'],
  ['CATALOG_RATE_LIMIT_MAX', '60'],
  ['IMPORT_AUTH_RATE_LIMIT_MAX', '300'],
  ['IMPORT_GUEST_RATE_LIMIT_MAX', '60'],
  ['IMAGE_PROXY_RATE_LIMIT_MAX', '600'],
  ['MUTATION_RATE_LIMIT_MAX', '300'],
  ['NOTION_RATE_LIMIT_MAX', '60'],
  ['RATE_LIMIT_WINDOW_MS', '300000'],
  ['SYNC_RATE_LIMIT_MAX', '300'],
]) {
  requireIncludes(
    commercialEnvPreflightPath,
    commercialEnvPreflight,
    `expectOptionalPositiveIntegerMax('${rateLimitEnvName}', ${maxValue})`,
  );
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  `require_optional_positive_integer_max ${rateLimitEnvName} ${maxValue}`,
);
}
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_log_level LOG_LEVEL',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_optional_port PORT',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_optional_host HOST',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_no_whitespace RATE_LIMIT_PREFIX',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_no_whitespace METRICS_BEARER_TOKEN',
);
requireIncludes(
  commercialEnvPreflightPath,
  commercialEnvPreflight,
  'expectDistinctSecretValues',
);
requireIncludes(
  apiRuntimeConfigPath,
  apiRuntimeConfig,
  'rejectDuplicateProductionSecrets',
);
requireIncludes(
  apiRuntimeConfigTestPath,
  apiRuntimeConfigTest,
  'blocks reused production runtime secrets',
);
requireIncludes(
  apiRuntimeConfigTestPath,
  apiRuntimeConfigTest,
  'blocks reused external API key encryption secrets in production',
);
requireIncludes(
  commercialEnvPreflightPath,
  commercialEnvPreflight,
  'must not reuse the same secret value as',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_distinct_secret_values',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'must not reuse the same secret value as',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'METRICS_INTERNAL_ACCESS_REVIEWED must be true or false when set.',
);
requireIncludes(
  'scripts/deploy/beta-preflight.sh',
  scriptContents.get('scripts/deploy/beta-preflight.sh') ?? '',
  'require_client_header_guard_mode WORK_ARCHIVE_CLIENT_HEADER_GUARD',
);
for (const rateLimitEnvName of [
  'AUTH_RATE_LIMIT_MAX',
  'CATALOG_RATE_LIMIT_MAX',
  'IMPORT_AUTH_RATE_LIMIT_MAX',
  'IMPORT_GUEST_RATE_LIMIT_MAX',
  'IMAGE_PROXY_RATE_LIMIT_MAX',
  'MUTATION_RATE_LIMIT_MAX',
  'NOTION_RATE_LIMIT_MAX',
  'RATE_LIMIT_WINDOW_MS',
  'SYNC_RATE_LIMIT_MAX',
]) {
  requireIncludes(commercialEnvPreflightPath, commercialEnvPreflight, rateLimitEnvName);
  requireIncludes(productionConfigTestPath, productionConfigTest, rateLimitEnvName);
}
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects reused production secret values in commercial env preflights',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects commercial env preflight non-plain or unsafe integer values',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects invalid API port values in commercial env preflights',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects runtime-only malformed host, Redis prefix, and metrics token values in commercial env preflights',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects default metrics bearer tokens in commercial env preflight',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects malformed metrics internal-access review flags in commercial env preflights',
);
requireIncludes(
  productionConfigTestPath,
  productionConfigTest,
  'rejects disabled production client header guard mode in commercial env preflights',
);
requireIncludes(productionConfigTestPath, productionConfigTest, "'1e3'");
requireIncludes(productionConfigTestPath, productionConfigTest, "'15000.0'");
requireIncludes(productionConfigTestPath, productionConfigTest, "'9007199254740992'");
requireIncludes(productionConfigTestPath, productionConfigTest, "'10000ms'");
requireIncludes(productionConfigTestPath, productionConfigTest, "'120/min'");

for (const [path, content] of [
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
  [runbookPath, runbook],
]) {
  requireIncludes(path, content, 'qa:deploy-scripts');
}
requireIncludes(
  runbookPath,
  runbook,
  'QA evidence scripts redact URL usernames, passwords, and sensitive query parameters',
);
const dockerRuntimePreflight =
  qaEvidenceScripts.get('scripts/qa/docker-runtime-preflight.mjs') ?? '';
for (const needle of [
  'DOCKER_RUNTIME_BUILD',
  'Docker CLI is not installed or not on PATH.',
  'Docker CLI is present, but docker --version failed in this environment.',
  'Docker Compose is unavailable, so compose config cannot run.',
  "status === 'BLOCKED'",
  'This report records an environment blocker, not a product failure.',
  'Set DOCKER_RUNTIME_BUILD=true on a Docker-enabled release runner to build production images.',
  "if (report.reportStatus === 'FAIL')",
]) {
  requireIncludes('scripts/qa/docker-runtime-preflight.mjs', dockerRuntimePreflight, needle);
}
for (const needle of [
  'FAKE_DOCKER_MODE',
  "DOCKER_RUNTIME_BUILD: 'true'",
  "FAKE_DOCKER_MODE: 'version-fail'",
  "DOCKER_RUNTIME_BUILD: 'treu'",
  'assertNoRawSecrets',
  'raw-inline-api-key',
  "report.json.reportStatus === 'BLOCKED'",
  "check.name === 'production image build' && check.status === 'PASS'",
]) {
  requireIncludes(
    dockerRuntimePreflightSelfTestPath,
    dockerRuntimePreflightSelfTest,
    needle,
  );
}
for (const [path, content] of [
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
  [runbookPath, runbook],
]) {
  requireIncludes(path, content, 'qa:docker-runtime');
}

if (failures.length > 0) {
  console.error('Deploy script policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Deploy script policy check passed.');
