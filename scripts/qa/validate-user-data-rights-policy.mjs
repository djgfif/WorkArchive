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

function requireMatchCount(path, content, pattern, expectedCount, message) {
  const matches = content.match(pattern) ?? [];

  if (matches.length !== expectedCount) {
    failures.push(`${path}: ${message} Found ${matches.length}.`);
  }
}

const controllerPath = 'apps/api/src/modules/auth/auth.controller.ts';
const servicePath = 'apps/api/src/modules/auth/auth.service.ts';
const metricsPath = 'apps/api/src/observability/metrics.service.ts';
const dtoPath =
  'apps/api/src/modules/auth/dto/auth-user-data-export-response.dto.ts';
const deletionRequestDtoPath =
  'apps/api/src/modules/auth/dto/auth-account-deletion-request.dto.ts';
const deletionPreviewDtoPath =
  'apps/api/src/modules/auth/dto/auth-account-deletion-preview-response.dto.ts';
const deletionResponseDtoPath =
  'apps/api/src/modules/auth/dto/auth-account-deletion-response.dto.ts';
const apiTestPath = 'apps/api/test/auth.profile.e2e-spec.ts';
const serviceTestPath = 'apps/api/test/auth.service.spec.ts';
const policyPath = 'docs/security/USER_DATA_RIGHTS_POLICY.md';
const asvsPath = 'docs/security/ASVS_COVERAGE.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const smokePath = 'scripts/qa/user-data-rights-smoke.mjs';
const deletionRehearsalPath = 'scripts/qa/account-deletion-rehearsal.mjs';
const packagePath = 'package.json';

const controller = readRequired(controllerPath);
const service = readRequired(servicePath);
const metrics = readRequired(metricsPath);
const dto = readRequired(dtoPath);
const deletionRequestDto = readRequired(deletionRequestDtoPath);
const deletionPreviewDto = readRequired(deletionPreviewDtoPath);
const deletionResponseDto = readRequired(deletionResponseDtoPath);
const apiTest = readRequired(apiTestPath);
const serviceTest = readRequired(serviceTestPath);
const policy = readRequired(policyPath);
const asvs = readRequired(asvsPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const smoke = readRequired(smokePath);
const deletionRehearsal = readRequired(deletionRehearsalPath);
const packageJson = readRequired(packagePath);

requireIncludes(controllerPath, controller, "@Get('data-export')");
requireIncludes(controllerPath, controller, "@Get('account/deletion-preview')");
requireIncludes(controllerPath, controller, "@Delete('account')");
requireIncludes(controllerPath, controller, 'AuthUserDataExportResponseDto');
requireIncludes(controllerPath, controller, 'AuthAccountDeletionRequestDto');
requireIncludes(
  controllerPath,
  controller,
  'AuthAccountDeletionPreviewResponseDto',
);
requireIncludes(controllerPath, controller, 'AuthAccountDeletionResponseDto');
requireIncludes(controllerPath, controller, 'auth.user_data.export');
requireIncludes(controllerPath, controller, 'auth.account.delete');
requireIncludes(controllerPath, controller, 'auth.account.delete_failed');
requireIncludes(controllerPath, controller, 'exportUserData(user)');
requireIncludes(controllerPath, controller, 'previewAccountDeletion(user)');
requireIncludes(controllerPath, controller, 'validateAccountDeletionRequest');
requireIncludes(
  controllerPath,
  controller,
  'const result = await this.authService.deleteAccount(',
);
requireMatchCount(
  controllerPath,
  controller,
  /operation:\s*'delete',\s*result:\s*'failure'/gs,
  1,
  'controller must only record delete failure metrics for pre-service validation failures to avoid double-counting service failures.',
);
requireIncludes(servicePath, service, 'async exportUserData(');
requireIncludes(servicePath, service, 'async previewAccountDeletion(');
requireIncludes(servicePath, service, 'async deleteAccount(');
requireIncludes(servicePath, service, 'validateAccountDeletionRequest(');
requireIncludes(servicePath, service, 'omittedSensitiveFields');
requireIncludes(servicePath, service, 'pickFields(');
requireIncludes(servicePath, service, 'securityEvent.updateMany');
requireIncludes(servicePath, service, 'catalogSubmission.updateMany');
requireIncludes(servicePath, service, 'catalogAuditLog.updateMany');
requireIncludes(servicePath, service, 'communityReport.updateMany');
requireIncludes(servicePath, service, 'communityModerationAuditLog.updateMany');
requireIncludes(servicePath, service, 'communityPost.findMany');
requireIncludes(servicePath, service, 'communityReaction.findMany');
requireIncludes(servicePath, service, 'communityReport.findMany');
requireIncludes(servicePath, service, 'recordUserDataRights');
requireIncludes(metricsPath, metrics, 'work_archive_user_data_rights_total');
requireIncludes(metricsPath, metrics, 'operation');
requireIncludes(metricsPath, metrics, 'deletion_preview');
requireIncludes(deletionRequestDtoPath, deletionRequestDto, 'confirmEmail');
requireIncludes(
  deletionRequestDtoPath,
  deletionRequestDto,
  'acknowledgeIrreversible',
);
requireIncludes(
  deletionPreviewDtoPath,
  deletionPreviewDto,
  'cascadeDeletedRecords',
);
requireIncludes(
  deletionPreviewDtoPath,
  deletionPreviewDto,
  'anonymizedRecords',
);
requireIncludes(
  deletionPreviewDtoPath,
  deletionPreviewDto,
  'omittedSensitiveFields',
);
requireIncludes(
  deletionResponseDtoPath,
  deletionResponseDto,
  'anonymizedRecords',
);
requireIncludes(dtoPath, dto, 'AuthUserDataExportResponseDto');
requireIncludes(
  apiTestPath,
  apiTest,
  'exports authenticated server-side account data',
);
requireIncludes(
  apiTestPath,
  apiTest,
  'previews authenticated account deletion impact',
);
requireIncludes(
  apiTestPath,
  apiTest,
  'deletes the authenticated server-side account',
);
requireIncludes(
  apiTestPath,
  apiTest,
  'audits rejected account deletion confirmation',
);
requireIncludes(
  apiTestPath,
  apiTest,
  'without double-counting controller metrics',
);
requireIncludes(
  serviceTestPath,
  serviceTest,
  'without selecting provider secrets or token hashes',
);
requireIncludes(
  serviceTestPath,
  serviceTest,
  'previews account deletion impact with owner-scoped counts only',
);
requireIncludes(
  serviceTestPath,
  serviceTest,
  'anonymizing retained operational records',
);
requireIncludes(
  serviceTestPath,
  serviceTest,
  'irreversible acknowledgement is missing',
);
requireIncludes(serviceTestPath, serviceTest, 'recordUserDataRights');
requireIncludes(
  serviceTestPath,
  serviceTest,
  '"(encryptedKey|authTag|iv|tokenHash|previousTokenHash|ipHash|userAgentHash)"',
);
requireIncludes(
  serviceTestPath,
  serviceTest,
  '"(changes|payload|result|note|reviewNote)"',
);

for (const [path, content] of [
  [policyPath, policy],
  [asvsPath, asvs],
  [commercialReadinessPath, commercialReadiness],
]) {
  requireIncludes(path, content, '/api/auth/data-export');
  requireIncludes(path, content, '/api/auth/account/deletion-preview');
  requireIncludes(path, content, '/api/auth/account');
  requireIncludes(path, content, 'refresh token hashes');
  requireIncludes(path, content, 'external provider encrypted keys');
  requireIncludes(path, content, 'Account deletion');
  requireIncludes(path, content, 'auth.account.delete');
  requireIncludes(path, content, 'auth.account.delete_failed');
  requireIncludes(path, content, 'work_archive_user_data_rights_total');
}

requireIncludes(policyPath, policy, 'auth.user_data.export');
requireIncludes(policyPath, policy, 'auth_sensitive');
requireIncludes(policyPath, policy, 'AUTH_SENSITIVE_RATE_LIMIT_MAX');
requireIncludes(policyPath, policy, 'cascadeDeletedRecords');
requireIncludes(policyPath, policy, 'acknowledgeIrreversible');
requireIncludes(policyPath, policy, 'http_400');
requireIncludes(policyPath, policy, 'set `userId` and `sessionId` to `null`');
requireIncludes(policyPath, policy, 'Do not use database dumps');
requireIncludes(
  policyPath,
  policy,
  'service execution failures are counted by `AuthService`',
);
requireIncludes(policyPath, policy, 'sync mutation result payloads');
requireIncludes(policyPath, policy, 'Notion preview change payloads');
requireIncludes(policyPath, policy, 'catalog submission payloads and notes');
requireIncludes(policyPath, policy, 'community posts authored by the user');
requireIncludes(policyPath, policy, '`moderatorId` to `null`');
requireIncludes(policyPath, policy, 'Community moderation audit logs keep');
requireIncludes(policyPath, policy, '`actorId`');
requireIncludes(policyPath, policy, 'npm run qa:user-data-rights-smoke');
requireIncludes(policyPath, policy, 'npm run qa:account-deletion-rehearsal');
requireIncludes(asvsPath, asvs, 'sensitive auth operation rate limits');
requireIncludes(asvsPath, asvs, 'auth_sensitive');
requireIncludes(asvsPath, asvs, 'sync result JSON');
requireIncludes(asvsPath, asvs, 'Notion preview change payloads');
requireIncludes(asvsPath, asvs, 'catalog submission payloads/notes');
requireIncludes(
  commercialReadinessPath,
  commercialReadiness,
  'npm run qa:user-data-rights-smoke',
);
requireIncludes(
  commercialReadinessPath,
  commercialReadiness,
  'npm run qa:account-deletion-rehearsal',
);
requireIncludes(smokePath, smoke, 'USER_DATA_RIGHTS_SMOKE_LIVE');
requireIncludes(smokePath, smoke, 'GET /api/auth/data-export');
requireIncludes(smokePath, smoke, 'GET /api/auth/account/deletion-preview');
requireIncludes(smokePath, smoke, 'DELETE /api/auth/account was not called');
requireIncludes(smokePath, smoke, 'secretFieldNamesAbsent');
requireIncludes(smokePath, smoke, 'highRiskPayloadFieldsAbsent');
requireIncludes(smokePath, smoke, 'rowPayloadAbsent');
requireIncludes(smokePath, smoke, 'hasHighRiskPayloadField');
requireIncludes(smokePath, smoke, 'cacheControlNoStore');
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'ACCOUNT_DELETION_REHEARSAL_LIVE',
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'ACCOUNT_DELETION_REHEARSAL_DISPOSABLE_ACCOUNT_ACK',
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'ACCOUNT_DELETION_REHEARSAL_CONFIRM',
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'delete-disposable-account',
);
requireIncludes(deletionRehearsalPath, deletionRehearsal, "method: 'DELETE'");
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  "'X-Work-Archive-Client': 'web'",
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'acknowledgeIrreversible: true',
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  '/auth/account/deletion-preview',
);
requireIncludes(deletionRehearsalPath, deletionRehearsal, '/auth/account');
requireIncludes(deletionRehearsalPath, deletionRehearsal, '/auth/data-export');
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'expectedStatuses: [401]',
);
requireIncludes(
  deletionRehearsalPath,
  deletionRehearsal,
  'Live mode is destructive',
);

requirePattern(
  packagePath,
  packageJson,
  /"qa:user-data-rights-policy":\s*"node scripts\/qa\/validate-user-data-rights-policy\.mjs"/,
  'package.json must expose qa:user-data-rights-policy.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:user-data-rights-smoke":\s*"node scripts\/qa\/user-data-rights-smoke\.mjs"/,
  'package.json must expose qa:user-data-rights-smoke.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:account-deletion-rehearsal":\s*"node scripts\/qa\/account-deletion-rehearsal\.mjs"/,
  'package.json must expose qa:account-deletion-rehearsal.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/validate-user-data-rights-policy\.mjs/,
  'commercial repository gates must syntax-check user data rights validation.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/user-data-rights-smoke\.mjs/,
  'commercial repository gates must syntax-check user data rights smoke.',
);
requirePattern(
  gatesPath,
  gates,
  /node --check scripts\/qa\/account-deletion-rehearsal\.mjs/,
  'commercial repository gates must syntax-check account deletion rehearsal.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:user-data-rights-policy/,
  'commercial repository gates must run qa:user-data-rights-policy.',
);
requirePattern(
  gatesPath,
  gates,
  /USER_DATA_RIGHTS_SMOKE_LIVE=false npm run qa:user-data-rights-smoke/,
  'commercial repository gates must run qa:user-data-rights-smoke in dry-run mode.',
);
requirePattern(
  gatesPath,
  gates,
  /ACCOUNT_DELETION_REHEARSAL_LIVE=false npm run qa:account-deletion-rehearsal/,
  'commercial repository gates must run qa:account-deletion-rehearsal in dry-run mode.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/validate-user-data-rights-policy\.mjs/,
  'Gate 1 local evidence helper must syntax-check user data rights validation.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/user-data-rights-smoke\.mjs/,
  'Gate 1 local evidence helper must syntax-check user data rights smoke.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/account-deletion-rehearsal\.mjs/,
  'Gate 1 local evidence helper must syntax-check account deletion rehearsal.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /npm run qa:user-data-rights-policy/,
  'Gate 1 local evidence helper must run qa:user-data-rights-policy.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /USER_DATA_RIGHTS_SMOKE_LIVE=false npm run qa:user-data-rights-smoke/,
  'Gate 1 local evidence helper must run qa:user-data-rights-smoke in dry-run mode.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /ACCOUNT_DELETION_REHEARSAL_LIVE=false npm run qa:account-deletion-rehearsal/,
  'Gate 1 local evidence helper must run qa:account-deletion-rehearsal in dry-run mode.',
);

if (failures.length > 0) {
  console.error('User data rights policy check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('User data rights policy check passed.');
