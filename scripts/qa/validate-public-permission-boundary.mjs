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

function requireIncludes(path, content, needles) {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${path} must include "${needle}".`);
    }
  }
}

function requirePattern(path, content, pattern, message) {
  if (!pattern.test(content)) {
    failures.push(`${path}: ${message}`);
  }
}

function extractClassBlock(path, content, className) {
  const marker = `export class ${className}`;
  const start = content.indexOf(marker);
  if (start === -1) {
    failures.push(`${path} must define ${className}.`);
    return '';
  }

  const next = content.indexOf('\nexport class ', start + marker.length);
  return next === -1 ? content.slice(start) : content.slice(start, next);
}

function requireAbsentIdentifiers(path, content, className, identifiers) {
  const classBlock = extractClassBlock(path, content, className);

  for (const identifier of identifiers) {
    if (new RegExp(`\\b${identifier}\\b`).test(classBlock)) {
      failures.push(
        `${path}: ${className} must not accept private field ${identifier}.`,
      );
    }
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

const boundaryPath = 'docs/security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md';
const bolaPath = 'docs/security/BOLA_MATRIX.md';
const schemaPath = 'apps/api/prisma/schema.prisma';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';
const packagePath = 'package.json';
const communityControllerPath =
  'apps/api/src/modules/community/community-reflection.controller.ts';
const communityCoreControllerPath =
  'apps/api/src/modules/community/community.controller.ts';
const communityDtoPath = 'apps/api/src/modules/community/dto/community.dto.ts';
const configureAppPath = 'apps/api/src/configure-app.ts';
const communityServiceBasePath =
  'apps/api/src/modules/community/services/community-service-base.ts';
const communityInteractionServicePath =
  'apps/api/src/modules/community/services/community-interaction.service.ts';
const communityPublishPath =
  'apps/web/src/features/community/services/community-publish.ts';
const communityPublishTestPath =
  'apps/web/src/features/community/services/community-publish.test.ts';
const communityReviewSharePath =
  'apps/web/src/features/community/services/community-review-share.ts';
const communityReviewShareTestPath =
  'apps/web/src/features/community/services/community-review-share.test.ts';
const communityPagePath =
  'apps/web/src/features/community/pages/CommunityReflectionPage.tsx';

const boundary = readRequired(boundaryPath);
const bola = readRequired(bolaPath);
const schema = readRequired(schemaPath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);
const packageJson = readRequired(packagePath);
const communityController = readRequired(communityControllerPath);
const communityCoreController = readRequired(communityCoreControllerPath);
const communityDto = readRequired(communityDtoPath);
const configureApp = readRequired(configureAppPath);
const communityServiceBase = readRequired(communityServiceBasePath);
const communityInteractionService = readRequired(
  communityInteractionServicePath,
);
const communityPublish = readRequired(communityPublishPath);
const communityPublishTest = readRequired(communityPublishTestPath);
const communityReviewShare = readRequired(communityReviewSharePath);
const communityReviewShareTest = readRequired(communityReviewShareTestPath);
const communityPage = readRequired(communityPagePath);

requireIncludes(boundaryPath, boundary, [
  '| Status | `canonical` |',
  'Gate 1 is default-private',
  '`private`',
  '`link_only`',
  '`exported`',
  'Do not add a `public` visibility state',
  'Data That Must Never Become Public By Accident',
  'Community Public Plane Permission Semantics',
  '`personal-archive` registers no Community surface',
  '`community-core`',
  '`community-full`',
  'personal record IDs, progress, personal tags, private reflections',
  'Global API validation rejects non-allowlisted request fields',
  'Repository implementation does not approve production exposure by itself',
  'Required Review Before Public Expansion',
  'npm run qa:public-boundary',
]);

requirePattern(
  schemaPath,
  schema,
  /enum\s+TierBoardVisibility\s*{[^}]*\bprivate\b[^}]*\blink_only\b[^}]*\bexported\b[^}]*}/s,
  'TierBoardVisibility must document private, link_only, and exported values in Prisma.',
);
requirePattern(
  schemaPath,
  schema,
  /visibility\s+TierBoardVisibility\s+@default\(private\)/,
  'tier board visibility must default to private.',
);
requirePattern(
  schemaPath,
  schema,
  /enum\s+TierBoardVisibility\s*{(?:(?!\bpublic\b)[^}])*}/s,
  'Gate 1 must not add a public tier-board visibility value without updating the boundary.',
);
requirePattern(
  bolaPath,
  bola,
  /\|\s*`tier_board`\s*\|\s*not_exposed\s*\|\s*not_exposed\s*\|\s*not_exposed\s*\|\s*satisfied\s*\|\s*satisfied\s*\|/,
  'BOLA matrix must keep tier boards non-exposed outside sync for Gate 1.',
);
requirePattern(
  bolaPath,
  bola,
  /\|\s*`community_post`\s*\|\s*satisfied\s*\|\s*not_exposed\s*\|\s*satisfied\s*\|/,
  'BOLA matrix must record implemented Community post read and owner-delete coverage.',
);
for (const model of [
  'CommunityPost',
  'UserCommunityProfile',
  'CommunityReview',
  'CommunityReaction',
  'CommunityReviewReaction',
  'CommunityComment',
  'CommunityCommentReaction',
  'CommunityFollow',
  'CommunityNotification',
  'CommunityReport',
  'CommunityModerationAuditLog',
]) {
  requirePattern(
    schemaPath,
    schema,
    new RegExp(`model\\s+${model}\\s*\\{`),
    `Prisma must define ${model} for the approved Community boundary.`,
  );
}
requirePattern(
  communityControllerPath,
  communityController,
  /@Get\(\)[\s\S]{0,620}getOptionalUser\(authorizationHeader\)/,
  'Community feed reads must stay public with optional bearer viewer flags.',
);
requirePattern(
  communityControllerPath,
  communityController,
  /@Post\(\)[\s\S]{0,260}@UseGuards\(JwtAuthGuard\)/,
  'Community publication must require authentication.',
);
requirePattern(
  communityControllerPath,
  communityController,
  /@RequireCommunityRelease\('reflection'\)[\s\S]{0,100}@UseGuards\(CommunityReleaseGuard\)/,
  'approved Community endpoints must require the reflection release capability.',
);
requirePattern(
  communityCoreControllerPath,
  communityCoreController,
  /@RequireCommunityRelease\('core'\)[\s\S]{0,100}@UseGuards\(CommunityReleaseGuard\)/,
  'Community core endpoints must require the core release capability.',
);
requirePattern(
  communityCoreControllerPath,
  communityCoreController,
  /@Get\('posts'\)[\s\S]{0,700}getOptionalUser\(authorizationHeader\)/,
  'Community core post reads must remain public with optional viewer flags.',
);
requirePattern(
  communityCoreControllerPath,
  communityCoreController,
  /@Post\('posts'\)[\s\S]{0,180}@UseGuards\(JwtAuthGuard\)/,
  'Community core publication must require authentication.',
);
for (const fullRoute of [
  "@Put('profiles/:handle/follow')",
  "@Get('taste/candidates')",
  "@Get('notifications')",
]) {
  const routeStart = communityCoreController.indexOf(fullRoute);
  const routeDecorators =
    routeStart === -1
      ? ''
      : communityCoreController.slice(routeStart, routeStart + 180);
  if (!routeDecorators.includes("@RequireCommunityRelease('full')")) {
    failures.push(
      `${communityCoreControllerPath}: ${fullRoute} must remain gated behind community-full.`,
    );
  }
}
for (const route of [
  "@Post(':id/reactions')",
  "@Post('moderation/:id/hide')",
  "@Post('moderation/:id/restore')",
  "@Post('moderation/reports/:id/resolve')",
]) {
  requirePattern(
    communityControllerPath,
    communityController,
    new RegExp(
      `${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,100}@HttpCode\\(HttpStatus\\.OK\\)`,
    ),
    `${route} must return the documented 200 status instead of the Nest POST default.`,
  );
}
requirePattern(
  communityServiceBasePath,
  communityServiceBase,
  /const PUBLIC_AUTHOR_SELECT = \{(?:(?!\b(?:email|id|oauthAccounts)\s*:)[^}])*\}/s,
  'Community public author selection must exclude raw ids, email, and OAuth data.',
);
requireIncludes(communityPublishPath, communityPublish, [
  "'thumbnailUrl' | 'title' | 'type'",
  'body: body.trim()',
  'workThumbnailUrl',
]);
requireIncludes(communityPublishTestPath, communityPublishTest, [
  "not.toHaveProperty('id')",
  "not.toHaveProperty('progress')",
  "not.toHaveProperty('tags')",
  'does not attach a work snapshot without an explicit selection',
]);
requireIncludes(communityReviewSharePath, communityReviewShare, [
  'buildCommunityReviewRequest',
  'body: draft.body.trim()',
  'rating: draft.rating || null',
  'spoiler: draft.spoiler',
]);
requireIncludes(communityReviewShareTestPath, communityReviewShareTest, [
  'never local ids or private notes',
  "not.toHaveProperty('catalogTitleId')",
  "not.toHaveProperty('personalTags')",
]);
requireIncludes(configureAppPath, configureApp, [
  'forbidNonWhitelisted: true',
  'whitelist: true',
]);

const forbiddenCommunityRecordFields = [
  'userRecordId',
  'workRecordId',
  'recordId',
  'progressCurrent',
  'progressTotal',
  'progressUnit',
  'personalTags',
  'privateReflection',
  'syncStatus',
  'clientMutationId',
  'timelineEntries',
];
for (const className of [
  'CreateCommunityPostDto',
  'UpsertCommunityReviewDto',
  'CreateCommunityCommentDto',
  'UpdateCommunityCommentDto',
]) {
  requireAbsentIdentifiers(
    communityDtoPath,
    communityDto,
    className,
    forbiddenCommunityRecordFields,
  );
}
requireIncludes(communityServiceBasePath, communityServiceBase, [
  'parseAllowedImageUrl',
  'CommunityPostStatus.published',
  "{ reactionCount: 'desc' as const }",
]);
requireIncludes(communityInteractionServicePath, communityInteractionService, [
  'reactionCount: { increment: 1 }',
  'reactionCount: { decrement: 1 }',
]);
requirePattern(
  schemaPath,
  schema,
  /@@index\(\[surface, status, reactionCount\(sort: Desc\), createdAt\(sort: Desc\), id\(sort: Desc\)\]\)/,
  'Popular Community reads must use the scalar reaction count index.',
);
requireIncludes(communityPagePath, communityPage, [
  'getDisplayImageUrl(post.author.avatarUrl)',
  'getDisplayImageUrl(',
  'post.work?.thumbnailUrl',
  'feedRequestId',
  'publicPreviewDescription',
]);
requirePattern(
  schemaPath,
  schema,
  /model\s+CommunityModerationAuditLog\s*\{[\s\S]*?actorId\s+String\?[\s\S]*?actor\s+User\?\s+@relation\([^)]*onDelete:\s*SetNull[^)]*\)/,
  'Community moderation audit actors must be nullable so account deletion preserves anonymized audit evidence.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:public-boundary/,
  'commercial repository gates must run qa:public-boundary.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /node --check scripts\/qa\/validate-public-permission-boundary\.mjs/,
  'Gate 1 local evidence helper must syntax-check public boundary validation.',
);
requirePattern(
  localEvidencePath,
  localEvidence,
  /npm run qa:public-boundary/,
  'Gate 1 local evidence helper must run qa:public-boundary.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:public-boundary":\s*"node scripts\/qa\/validate-public-permission-boundary\.mjs"/,
  'package.json must expose qa:public-boundary.',
);

const standaloneTierBoardControllers = walkFiles(join(root, 'apps/api/src'))
  .map((file) => relative(root, file))
  .filter((file) => /tier-boards?.*\.controller\.ts$/.test(file));

if (standaloneTierBoardControllers.length > 0) {
  failures.push(
    `Gate 1 boundary says tier boards are not standalone public API routes, but found controller(s): ${standaloneTierBoardControllers.join(', ')}`,
  );
}

if (failures.length > 0) {
  console.error('Public permission boundary check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Public permission boundary check passed.');
