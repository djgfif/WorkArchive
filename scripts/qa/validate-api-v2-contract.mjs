#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    failures.push(path + ' is missing.');
    return '';
  }
  return readFileSync(fullPath, 'utf8');
}

function requireMatch(path, content, pattern, message) {
  if (!pattern.test(content)) failures.push(path + ': ' + message);
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const v2ControllerPath =
  'apps/api/src/modules/user-records/user-records-v2.controller.ts';
const v2DtoPath = 'apps/api/src/modules/user-records/dto/v2-user-record.dto.ts';
const catalogControllerPath =
  'apps/api/src/modules/catalog/catalog.controller.ts';
const worksControllerPath = 'apps/api/src/modules/works/works.controller.ts';
const communityControllerPath =
  'apps/api/src/modules/community/community.controller.ts';
const specPath = 'openapi/work-archive-api.json';

const v2Controller = readRequired(v2ControllerPath);
const v2Dto = readRequired(v2DtoPath);
const catalogController = readRequired(catalogControllerPath);
const worksController = readRequired(worksControllerPath);
const communityController = readRequired(communityControllerPath);
const specContent = readRequired(specPath);

requireMatch(
  v2ControllerPath,
  v2Controller,
  /@Controller\('v2\/user-records'\)/,
  'must expose the additive v2 user-record contract.',
);
requireMatch(
  v2DtoPath,
  v2Dto,
  /oneOf:[\s\S]{0,500}CatalogUserRecordIdentityV2Schema[\s\S]{0,500}ExternalUserRecordIdentityV2Schema[\s\S]{0,500}ManualUserRecordIdentityV2Schema/,
  'must publish all three discriminated identity schemas.',
);
requireMatch(
  catalogControllerPath,
  catalogController,
  /@Controller\(\['catalog', 'v2\/catalog'\]\)/,
  'must expose additive v2 catalog aliases.',
);
requireMatch(
  worksControllerPath,
  worksController,
  /deprecated: true/,
  'must mark the compatibility API deprecated.',
);
requireMatch(
  worksControllerPath,
  worksController,
  /api\.legacy_works\.used/,
  'must observe compatibility use without user data.',
);
if (
  /api\.legacy_works\.used[\s\S]{0,300}(userId|email|recordId)/.test(
    worksController,
  )
) {
  failures.push(
    worksControllerPath + ': legacy usage telemetry must remain PII-free.',
  );
}
if (/CommunityService/.test(communityController)) {
  failures.push(
    communityControllerPath +
      ': controllers must depend on capability services, not the legacy monolith.',
  );
}

for (const name of [
  'community-query.service.ts',
  'community-publication.service.ts',
  'community-interaction.service.ts',
  'community-profile.service.ts',
  'community-moderation.service.ts',
]) {
  readRequired('apps/api/src/modules/community/services/' + name);
}

const webRoot = join(root, 'apps/web/src');
for (const fullPath of walk(webRoot)) {
  if (!/\.[cm]?[jt]sx?$/.test(fullPath)) continue;
  if (fullPath.includes(join('shared', 'generated'))) continue;
  const content = readFileSync(fullPath, 'utf8');
  if (
    /apiRequest[\s\S]{0,120}['"\x60]\/(?:api\/)?works(?:[/'"\x60?])/.test(
      content,
    )
  ) {
    failures.push(
      relative(root, fullPath) +
        ': web must not consume the flat Works HTTP API.',
    );
  }
}

if (specContent) {
  const spec = JSON.parse(specContent);
  const v2Identity =
    spec.components?.schemas?.CreateUserRecordV2Dto?.properties?.identity;
  if (!spec.paths?.['/api/v2/catalog/search']) {
    failures.push(specPath + ': /api/v2/catalog is missing.');
  }
  if (!spec.paths?.['/api/v2/user-records']) {
    failures.push(specPath + ': /api/v2/user-records is missing.');
  }
  if (
    v2Identity?.discriminator?.propertyName !== 'kind' ||
    v2Identity?.oneOf?.length !== 3
  ) {
    failures.push(
      specPath + ': v2 create identity must be a three-way discriminator.',
    );
  }
  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    if (!path.startsWith('/api/works')) continue;
    for (const operation of Object.values(operations)) {
      if (operation.deprecated !== true) {
        failures.push(specPath + ': ' + path + ' must remain deprecated.');
      }
    }
  }
}

if (failures.length > 0) {
  console.error('API v2 contract validation failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('API v2 contract passed.');
