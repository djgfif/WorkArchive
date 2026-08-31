import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const moduleRoot = path.join(root, 'apps/api/src/modules/community');

function read(relativePath) {
  return fs.readFileSync(path.join(moduleRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function lineCount(source) {
  return source.trimEnd().split(/\r?\n/).length;
}

function hasMethod(source, method) {
  return new RegExp(
    `\\n\\s+(?:(?:public|protected|private)\\s+)?(?:async\\s+)?${method}\\(`,
  ).test(source);
}

const facade = read('community.service.ts');
assert(
  lineCount(facade) <= 220,
  `CommunityService compatibility facade grew to ${lineCount(facade)} lines.`,
);
assert(
  facade.includes(
    '@deprecated Inject a role-specific Community service instead.',
  ),
  'CommunityService must remain an explicitly deprecated compatibility facade.',
);
assert(
  !facade.includes('PrismaService') && !facade.includes('@prisma/client'),
  'CommunityService facade must not own persistence or domain implementation.',
);

const expectedServices = new Map([
  [
    'services/community-query.service.ts',
    [
      'listPosts',
      'getPost',
      'listFeed',
      'listTrendingWorks',
      'listReviewsByWork',
      'getReview',
      'listComments',
    ],
  ],
  [
    'services/community-publication.service.ts',
    [
      'createPost',
      'deletePost',
      'upsertReview',
      'deleteReview',
      'createComment',
      'updateComment',
      'deleteComment',
    ],
  ],
  [
    'services/community-interaction.service.ts',
    ['setTargetReaction', 'setFollow', 'addReaction', 'removeReaction'],
  ],
  ['services/community-profile.service.ts', ['getProfile', 'updateProfile']],
  [
    'services/community-discovery.service.ts',
    ['listTasteCandidates', 'listNotifications', 'markNotificationsRead'],
  ],
  [
    'services/community-moderation.service.ts',
    [
      'reportPost',
      'reportReview',
      'reportComment',
      'listReports',
      'hidePost',
      'restorePost',
      'hideReview',
      'restoreReview',
      'hideComment',
      'restoreComment',
      'resolveReport',
    ],
  ],
]);

for (const [relativePath, methods] of expectedServices) {
  const source = read(relativePath);
  assert(
    lineCount(source) <= 700,
    `${relativePath} exceeds the 700-line role-service limit.`,
  );
  assert(
    source.includes('extends CommunityServiceBase'),
    `${relativePath} must reuse the common Community policy/read-model layer.`,
  );
  assert(
    !source.includes("from '../community.service'") &&
      !source.includes('this.community.'),
    `${relativePath} must own implementation instead of delegating to CommunityService.`,
  );
  for (const method of methods) {
    assert(hasMethod(source, method), `${relativePath} must own ${method}().`);
  }
}

const base = read('services/community-service-base.ts');
for (const policyMethod of [
  'assertCommunityIdentity',
  'assertVisibleTarget',
  'findVisibleModerationTargetOrThrow',
  'assertModerator',
]) {
  assert(
    hasMethod(base, policyMethod),
    `Common Community policy layer must own ${policyMethod}().`,
  );
}

for (const controller of [
  'community.controller.ts',
  'community-reflection.controller.ts',
]) {
  assert(
    !read(controller).includes('CommunityService'),
    `${controller} must inject role-specific services, not the compatibility facade.`,
  );
}

console.log('Community service boundaries passed.');
