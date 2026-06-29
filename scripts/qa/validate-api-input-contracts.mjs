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

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function hasNearbyApiBody(content, index, dtoType) {
  const windowStart = Math.max(0, index - 900);
  const window = content.slice(windowStart, index);

  return (
    window.includes('@ApiBody') &&
    new RegExp(`type:\\s*${escapeRegExp(dtoType)}\\b`).test(window)
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const configureAppPath = 'apps/api/src/configure-app.ts';
const securityAuditPath = 'apps/api/src/security/security-audit.service.ts';
const securityMiddlewarePath = 'apps/api/src/security/security-middleware.ts';
const payloadValidationPath =
  'apps/api/src/modules/sync/services/sync-payload-validation.service.ts';
const importsControllerPath = 'apps/api/src/modules/imports/imports.controller.ts';
const inputContractPath = 'docs/security/API_INPUT_CONTRACTS.md';
const appSecurityTestPath = 'apps/api/test/app-security.e2e-spec.ts';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const gate1ValidatorPath = 'scripts/qa/validate-gate1-evidence.mjs';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';

const configureApp = readRequired(configureAppPath);
const securityAudit = readRequired(securityAuditPath);
const securityMiddleware = readRequired(securityMiddlewarePath);
const payloadValidation = readRequired(payloadValidationPath);
const importsController = readRequired(importsControllerPath);
const inputContract = readRequired(inputContractPath);
const appSecurityTest = readRequired(appSecurityTestPath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const gate1Validator = readRequired(gate1ValidatorPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const evidence = readRequired(evidencePath);

requirePattern(
  configureAppPath,
  configureApp,
  /new ValidationPipe\(\{[\s\S]{0,360}forbidNonWhitelisted:\s*true,[\s\S]{0,360}transform:\s*true,[\s\S]{0,360}validationError:\s*\{[\s\S]{0,160}target:\s*false,[\s\S]{0,160}value:\s*false,[\s\S]{0,360}whitelist:\s*true,/,
  'global ValidationPipe must transform, whitelist, reject unknown DTO input, and avoid echoing target/value data.',
);
requireIncludes(configureAppPath, configureApp, 'createRequestTargetLengthGuard');
requireIncludes(configureAppPath, configureApp, 'app.use(createRequestTargetLengthGuard(securityAudit))');
requireIncludes(configureAppPath, configureApp, 'createApiContentTypeGuard');
requireIncludes(configureAppPath, configureApp, 'app.use(createApiContentTypeGuard(securityAudit))');
requireIncludes(
  securityMiddlewarePath,
  securityMiddleware,
  'MAXIMUM_REQUEST_TARGET_LENGTH = 8_192',
);
requireIncludes(securityMiddlewarePath, securityMiddleware, 'http.request_target_too_long');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'SUPPORTED_API_BODY_MEDIA_TYPES');
requireIncludes(securityMiddlewarePath, securityMiddleware, 'http.unsupported_media_type');
requireIncludes(securityAuditPath, securityAudit, "'http.request_target_too_long'");
requireIncludes(securityAuditPath, securityAudit, "'http.unsupported_media_type'");
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'does not echo invalid DTO values in validation errors',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'rejects overlong request targets before controller handling without echoing query data',
);
requireIncludes(appSecurityTestPath, appSecurityTest, 'req_long_target_1');
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'returns sanitized JSON for malformed request bodies before validation',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'returns sanitized JSON for oversized request bodies before validation',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'rejects unsupported request body media types before validation',
);
requireIncludes(
  appSecurityTestPath,
  appSecurityTest,
  'allows unsafe API requests without request bodies to omit content type',
);
requirePattern(
  payloadValidationPath,
  payloadValidation,
  /forbidNonWhitelisted:\s*true,[\s\S]{0,220}whitelist:\s*true,/,
  'sync payload validation must reject non-whitelisted nested payload fields.',
);

const controllerFiles = walkFiles(join(root, 'apps/api/src'))
  .map((file) => relative(root, file))
  .filter((file) => file.endsWith('controller.ts'))
  .sort();

const allowedUnknownBodies = new Map([
  [
    'apps/api/src/modules/imports/imports.controller.ts:upsertAladinKeyDto',
    'UpsertAladinKeyDto',
  ],
  [
    'apps/api/src/modules/imports/imports.controller.ts:upsertProviderKeyDto',
    'UpsertProviderKeyDto',
  ],
]);

for (const path of controllerFiles) {
  const content = readRequired(path);
  const bodyPattern = /@Body\(\)\s+([A-Za-z0-9_]+):\s*([A-Za-z0-9_]+)/g;
  let match;

  while ((match = bodyPattern.exec(content)) !== null) {
    const [, parameterName, typeName] = match;
    const line = lineNumberForIndex(content, match.index);
    const key = `${path}:${parameterName}`;
    const allowedUnknownDto = allowedUnknownBodies.get(key);

    if (typeName === 'unknown') {
      if (!allowedUnknownDto) {
        failures.push(
          `${path}:${line} @Body() ${parameterName} uses unknown without an explicit input-contract exception.`,
        );
        continue;
      }

      if (!hasNearbyApiBody(content, match.index, allowedUnknownDto)) {
        failures.push(
          `${path}:${line} @Body() ${parameterName} unknown exception must document ${allowedUnknownDto} with @ApiBody.`,
        );
      }
      continue;
    }

    if (!typeName.endsWith('Dto')) {
      failures.push(
        `${path}:${line} @Body() ${parameterName} must use a named DTO type, found ${typeName}.`,
      );
      continue;
    }

    if (!hasNearbyApiBody(content, match.index, typeName)) {
      failures.push(
        `${path}:${line} @Body() ${parameterName} must have nearby @ApiBody({ type: ${typeName} }).`,
      );
    }
  }

  const queryPattern = /@Query\(\)\s+([A-Za-z0-9_]+):\s*([A-Za-z0-9_]+)/g;

  while ((match = queryPattern.exec(content)) !== null) {
    const [, parameterName, typeName] = match;
    const line = lineNumberForIndex(content, match.index);

    if (!typeName.endsWith('Dto')) {
      failures.push(
        `${path}:${line} @Query() ${parameterName} must use a named DTO type, found ${typeName}.`,
      );
    }
  }
}

for (const [key, dtoType] of allowedUnknownBodies) {
  const [, parameterName] = key.split(':');

  requireIncludes(importsControllerPath, importsController, `@Body() ${parameterName}: unknown`);
  requireIncludes(importsControllerPath, importsController, `type: ${dtoType}`);
}
requireIncludes(
  importsControllerPath,
  importsController,
  'resolveProviderCredentialValuesFromPayload',
);

for (const phrase of [
  'global ValidationPipe',
  'request target',
  'validationError',
  'sync payload validation',
  'provider credential exception',
  'npm run qa:api-input-contracts',
]) {
  requireIncludes(inputContractPath, inputContract, phrase);
}

requirePattern(
  packagePath,
  packageJson,
  /"qa:api-input-contracts":\s*"node scripts\/qa\/validate-api-input-contracts\.mjs"/,
  'package.json must expose qa:api-input-contracts.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-api-input-contracts\.mjs/,
  'commercial repository gates must syntax-check API input contract validation.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:api-input-contracts/,
  'commercial repository gates must run qa:api-input-contracts.',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:api-input-contracts');
requireIncludes(gate1ValidatorPath, gate1Validator, 'npm run qa:api-input-contracts');

for (const [path, content] of [
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
  [evidencePath, evidence],
]) {
  requireIncludes(path, content, 'qa:api-input-contracts');
}

if (failures.length > 0) {
  console.error('API input contract check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('API input contract check passed.');
