#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const entrypoint = join(
  root,
  'apps/web/docker-entrypoint.d/40-work-archive-config.sh',
);
const failures = [];
const profiles = [
  'personal-archive',
  'community-reflection-alpha',
  'community-social-experiment',
];

function generate(profile) {
  const directory = mkdtempSync(join(tmpdir(), 'work-archive-profile-'));
  const output = join(directory, 'work-archive-config.js');

  try {
    execFileSync('sh', [entrypoint], {
      env: {
        ...process.env,
        PRODUCT_RELEASE_PROFILE: profile,
        WORK_ARCHIVE_CONFIG_OUTPUT: output,
      },
      stdio: 'pipe',
    });
    return readFileSync(output, 'utf8');
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

for (const profile of profiles) {
  const config = generate(profile);
  if (
    !config.includes(
      `window.__WORK_ARCHIVE_CONFIG__.productReleaseProfile = '${profile}';`,
    )
  ) {
    failures.push(`runtime config must expose ${profile}.`);
  }
}

try {
  generate('community-typo');
  failures.push('invalid runtime profiles must fail container startup.');
} catch {
  // Expected: an explicit invalid server profile is a deployment error.
}

const dockerfile = readFileSync(join(root, 'apps/web/Dockerfile'), 'utf8');
const nginx = readFileSync(join(root, 'apps/web/nginx.conf'), 'utf8');
const composeFiles = ['compose.yml', 'compose.prod.yml'].map((path) => [
  path,
  readFileSync(join(root, path), 'utf8'),
]);

if (dockerfile.includes('ARG VITE_PRODUCT_RELEASE_PROFILE')) {
  failures.push('web image must not bake a release profile into its bundle.');
}
if (!dockerfile.includes('/docker-entrypoint.d/40-work-archive-config.sh')) {
  failures.push('web image must install the runtime config entrypoint.');
}
if (!nginx.includes('alias /tmp/work-archive-config.js;')) {
  failures.push('nginx must serve the generated runtime config from /tmp.');
}
if (!nginx.includes('Cache-Control "no-store" always;')) {
  failures.push('runtime config must remain non-cacheable.');
}

for (const [path, content] of composeFiles) {
  if (!content.includes('PRODUCT_RELEASE_PROFILE: ${PRODUCT_RELEASE_PROFILE:-personal-archive}')) {
    failures.push(`${path} must pass the same fail-closed profile to web and API.`);
  }
  if (!content.includes('/api/product-release')) {
    failures.push(`${path} web healthcheck must compare the API release profile.`);
  }
}

if (failures.length > 0) {
  console.error('Product release runtime validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Product release runtime validation passed.');
