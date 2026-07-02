#!/usr/bin/env node
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const preflightPath = resolve(rootDir, 'scripts/qa/docker-runtime-preflight.mjs');
const workspace = mkdtempSync(join(tmpdir(), 'work-archive-docker-runtime-self-test-'));
const fakeBin = join(workspace, 'bin');
const fakeHome = join(workspace, 'home');
const fakeDockerPath = join(fakeBin, 'docker');
const reportRoot = join(workspace, 'reports');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFakeDocker() {
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(fakeHome, { recursive: true });
  writeFileSync(
    fakeDockerPath,
    `#!/usr/bin/env bash
set -euo pipefail

mode="\${FAKE_DOCKER_MODE:-pass}"

if [[ "\${1:-}" == "--version" ]]; then
  if [[ "$mode" == "version-fail" ]]; then
    printf '%s\\n' 'version failed token=raw-version-token https://raw-user:raw-pass@example.test/?api_key=raw-api-key' >&2
    exit 23
  fi
  printf '%s\\n' 'Docker version 99.0.0, build selftest'
  exit 0
fi

if [[ "\${1:-}" == "compose" && "\${2:-}" == "version" ]]; then
  printf '%s\\n' 'Docker Compose version v99.0.0-selftest'
  exit 0
fi

if [[ "\${1:-}" == "compose" ]]; then
  last_arg="\${@: -1}"
  if [[ "$last_arg" == "config" ]]; then
    printf '%s\\n' 'compose ok https://raw-user:raw-pass@example.test/path?token=raw-url-token API_KEY=raw-inline-api-key DATABASE_URL=postgresql://raw-db-user:raw-db-pass@db/work_archive'
    exit 0
  fi
  if [[ "$last_arg" == "build" ]]; then
    printf '%s\\n' 'build ok refresh_token=raw-refresh-token REDIS_URL=redis://raw-redis-user:raw-redis-pass@redis:6379/0'
    exit 0
  fi
fi

printf 'unexpected docker args:' >&2
printf ' %q' "$@" >&2
printf '\\n' >&2
exit 64
`,
  );
  chmodSync(fakeDockerPath, 0o755);
}

function runPreflight(name, env = {}) {
  const reportDir = join(reportRoot, name);
  mkdirSync(reportDir, { recursive: true });

  const result = spawnSync(process.execPath, [preflightPath], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
      COMPOSE_FILE: 'compose.prod.yml',
      DOCKER_RUNTIME_REPORT_DIR: reportDir,
      ENV_FILE: '.env.example',
      HOME: fakeHome,
      PATH: `${fakeBin}:/usr/bin:/bin`,
    },
  });
  const report = readLatestReport(reportDir);

  return { report, result };
}

function readLatestReport(reportDir) {
  const jsonReports = readdirSync(reportDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  if (jsonReports.length === 0) {
    return null;
  }

  const latestPath = join(reportDir, jsonReports.at(-1));
  return {
    json: JSON.parse(readFileSync(latestPath, 'utf8')),
    raw: readFileSync(latestPath, 'utf8'),
  };
}

function assertExit(result, expectedStatus, label) {
  assert(
    result.status === expectedStatus,
    `${label} exited ${result.status}, expected ${expectedStatus}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function assertNoRawSecrets(rawReport) {
  for (const rawSecret of [
    'raw-api-key',
    'raw-db-pass',
    'raw-db-user',
    'raw-inline-api-key',
    'raw-redis-pass',
    'raw-redis-user',
    'raw-refresh-token',
    'raw-url-token',
    'raw-user',
    'raw-version-token',
  ]) {
    assert(!rawReport.includes(rawSecret), `Report leaked ${rawSecret}.`);
  }
}

try {
  writeFakeDocker();

  const configOnly = runPreflight('config-only');
  assertExit(configOnly.result, 0, 'config-only preflight');
  assert(configOnly.report, 'config-only preflight did not write a report.');
  assert(configOnly.report.json.reportStatus === 'PASS', 'config-only report must pass.');
  assert(configOnly.report.json.mode === 'config-only', 'config-only report mode mismatch.');
  assert(
    configOnly.report.json.checks.some(
      (check) => check.name === 'production image build' && check.status === 'NOT_RUN',
    ),
    'config-only report must mark production image build as NOT_RUN.',
  );
  assertNoRawSecrets(configOnly.report.raw);

  const build = runPreflight('build', { DOCKER_RUNTIME_BUILD: 'true' });
  assertExit(build.result, 0, 'build preflight');
  assert(build.report, 'build preflight did not write a report.');
  assert(build.report.json.reportStatus === 'PASS', 'build report must pass.');
  assert(build.report.json.mode === 'config-and-build', 'build report mode mismatch.');
  assert(
    build.report.json.checks.some(
      (check) => check.name === 'production image build' && check.status === 'PASS',
    ),
    'build report must run production image build.',
  );
  assertNoRawSecrets(build.report.raw);

  const blocked = runPreflight('version-fail', {
    FAKE_DOCKER_MODE: 'version-fail',
  });
  assertExit(blocked.result, 0, 'blocked preflight');
  assert(blocked.report, 'blocked preflight did not write a report.');
  assert(blocked.report.json.reportStatus === 'BLOCKED', 'version failure must be BLOCKED.');
  assert(
    blocked.report.json.checks.some(
      (check) => check.name === 'docker compose plugin' && check.status === 'BLOCKED',
    ),
    'version failure must block docker compose plugin evidence.',
  );
  assertNoRawSecrets(blocked.report.raw);

  const invalidBoolean = runPreflight('invalid-boolean', {
    DOCKER_RUNTIME_BUILD: 'treu',
  });
  assertExit(invalidBoolean.result, 1, 'invalid boolean preflight');
  assert(
    invalidBoolean.result.stderr.includes('DOCKER_RUNTIME_BUILD must be true or false when set.'),
    'invalid boolean failure should explain the accepted values.',
  );
  assert(!invalidBoolean.report, 'invalid boolean preflight must not write a report.');

  console.log('Docker runtime preflight self-test passed.');
} finally {
  rmSync(workspace, { force: true, recursive: true });
}
