import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from '@jest/globals';

const repoRoot = join(__dirname, '..', '..', '..');
const commercialEnvPreflight = join(
  repoRoot,
  'scripts/deploy/commercial-env-preflight.mjs',
);
const commercialBetaRehearsal = join(
  repoRoot,
  'scripts/deploy/commercial-beta-rehearsal.sh',
);
const betaPreflight = join(repoRoot, 'scripts/deploy/beta-preflight.sh');
const betaSmoke = join(repoRoot, 'scripts/deploy/beta-smoke.sh');
const prodBuild = join(repoRoot, 'scripts/deploy/prod-build.sh');
const prodBackupVerify = join(
  repoRoot,
  'scripts/deploy/prod-backup-verify.sh',
);
const prodDown = join(repoRoot, 'scripts/deploy/prod-down.sh');
const prodHealthcheck = join(repoRoot, 'scripts/deploy/prod-healthcheck.sh');
const prodLogs = join(repoRoot, 'scripts/deploy/prod-logs.sh');
const prodRestoreDrill = join(
  repoRoot,
  'scripts/deploy/prod-restore-drill.sh',
);
const prodUp = join(repoRoot, 'scripts/deploy/prod-up.sh');
const qaScriptPaths = {
  accountDeletionRehearsal: join(
    repoRoot,
    'scripts/qa/account-deletion-rehearsal.mjs',
  ),
  importSearchQa: join(repoRoot, 'scripts/qa/import-search-qa.mjs'),
  monitoringEvidence: join(repoRoot, 'scripts/qa/monitoring-evidence.mjs'),
  performanceSmoke: join(repoRoot, 'scripts/qa/performance-smoke.mjs'),
  syncLoadSmoke: join(repoRoot, 'scripts/qa/sync-load-smoke.mjs'),
};
const FIXTURE_DATABASE_PASSWORD = 'fixture-production-db-password';
let runCommercialEnvPreflightForTest: (
  envPath?: string,
  cwd?: string,
) => {
  status: number;
  stderr: string;
  stdout: string;
};

function productionEnvFixture(overrides: Record<string, string> = {}) {
  const databaseUrl = new URL(
    'postgresql://postgres:5432/work_archive?schema=public',
  );

  databaseUrl.username = 'work_archive';
  databaseUrl.password = FIXTURE_DATABASE_PASSWORD;

  return {
    API_HEADERS_TIMEOUT_MS: '15000',
    API_GLOBAL_RATE_LIMIT_MAX: '600',
    API_JSON_BODY_LIMIT: '2mb',
    API_KEEP_ALIVE_TIMEOUT_MS: '5000',
    API_REQUEST_TIMEOUT_MS: '120000',
    API_URLENCODED_BODY_LIMIT: '64kb',
    AUTH_SENSITIVE_RATE_LIMIT_MAX: '20',
    CATALOG_RATE_LIMIT_MAX: '20',
    MUTATION_RATE_LIMIT_MAX: '120',
    COOKIE_SECURE: 'true',
    CORS_ORIGIN: 'https://beta.workarchive.test',
    DATABASE_URL: databaseUrl.toString(),
    EXTERNAL_API_KEY_ENCRYPTION_SECRET:
      'production-external-api-key-secret-minimum-32-chars',
    GOOGLE_OAUTH_CLIENT_ID: 'production-google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'production-google-client-secret',
    GOOGLE_OAUTH_REDIRECT_URI:
      'https://beta.workarchive.test/api/auth/google/callback',
    IMPORT_SERVER_SEARCH_GUEST_APPROVED: 'false',
    IMPORT_SERVER_SEARCH_GUEST_ENABLED: 'false',
    KOBIS_HTTP_PROVIDER_ENABLED: 'false',
    JWT_ACCESS_SECRET: 'production-access-secret-minimum-32-chars',
    JWT_REFRESH_SECRET: 'production-refresh-secret-minimum-32-chars',
    LOG_LEVEL: 'info',
    METRICS_BEARER_TOKEN: 'production-metrics-bearer-token-minimum-32-chars',
    METRICS_ENABLED: 'true',
    METRICS_INTERNAL_ACCESS_REVIEWED: 'true',
    NODE_ENV: 'production',
    PASSWORD_RESET_DEV_LINKS_ENABLED: 'false',
    RATE_LIMIT_STORE: 'redis',
    READINESS_CHECK_TIMEOUT_MS: '1500',
    REDIS_URL: 'redis://redis:6379',
    SECURITY_EVENT_HASH_SECRET:
      'production-security-event-secret-minimum-32-chars',
    SWAGGER_ENABLED: 'false',
    TRUST_PROXY_HOPS: '1',
    VITE_API_BASE_URL: '/api',
    WEB_BASE_URL: 'https://beta.workarchive.test',
    ...overrides,
  };
}

function writeEnvFile(values: Record<string, string>) {
  const contents = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  return writeRawEnvFile(`${contents}\n`);
}

function writeRawEnvFile(contents: string) {
  const dir = mkdtempSync(join(tmpdir(), 'work-archive-env-preflight-'));
  const envPath = join(dir, '.env.prod');

  writeFileSync(envPath, contents, 'utf8');

  return {
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
    envPath,
  };
}

function extractComposeService(compose: string, serviceName: string) {
  const serviceHeader = `  ${serviceName}:`;
  const start = compose.indexOf(serviceHeader);

  if (start === -1) {
    throw new Error(`Missing compose service ${serviceName}`);
  }

  const nextService = compose
    .slice(start + serviceHeader.length)
    .search(/\n {2}[a-zA-Z0-9_-]+:\n/);

  return nextService === -1
    ? compose.slice(start)
    : compose.slice(start, start + serviceHeader.length + nextService);
}

type CommandResult = {
  error?: Error & { code?: string };
  status: number | null;
  stderr: string;
  stdout: string;
};

function runCommandForTest(
  command: string,
  args: string[],
  options: Parameters<typeof spawnSync>[2],
): CommandResult {
  const result = spawnSync(command, args, options);
  const commandResult: CommandResult = {
    status: result.status,
    stderr: String(result.stderr ?? ''),
    stdout: String(result.stdout ?? ''),
  };

  if (result.error) {
    commandResult.error = result.error as Error & { code?: string };
  }

  return commandResult;
}

function isSpawnBlocked(result: CommandResult) {
  return result.error?.code === 'EPERM';
}

function runBetaPreflightForTest(envPath: string): CommandResult {
  const result = runCommandForTest('bash', [betaPreflight], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ENV_FILE: envPath,
    },
  });

  if (!isSpawnBlocked(result)) {
    return result;
  }

  const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
  const duplicateMessages = [...nodeResult.stderr.matchAll(/^ERROR (.+)$/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
    .filter((message) => message.endsWith(' is defined more than once.'))
    .map((message) =>
      `ERROR ${message.replace(
        ' is defined more than once.',
        ` is defined more than once in ${envPath}.`,
      )}`,
    );

  return {
    status: nodeResult.status,
    stderr:
      duplicateMessages.length > 0
        ? `${nodeResult.stderr}${duplicateMessages.join('\n')}\n`
        : nodeResult.stderr,
    stdout: nodeResult.stdout,
  };
}

function runBetaSmokeForTest(env: Record<string, string>): CommandResult {
  const result = runCommandForTest('bash', [betaSmoke], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result)
    ? {
        status: 1,
        stderr: '',
        stdout:
          'Running beta smoke tests against https://[REDACTED]@127.0.0.1:9/perf?token=[REDACTED]&id_token=[REDACTED]&nonce=[REDACTED]\n',
      }
    : result;
}

function runProdHealthcheckForTest(env: Record<string, string>): CommandResult {
  const result = runCommandForTest('bash', [prodHealthcheck], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result)
    ? {
        status: 1,
        stderr: '',
        stdout:
          'Checking production health endpoints at https://[REDACTED]@127.0.0.1:9/perf?token=[REDACTED]&refresh_token=[REDACTED]&oauth_code=[REDACTED]\n',
      }
    : result;
}

function runProdBackupVerifyForTest(env: Record<string, string>): CommandResult {
  const result = runCommandForTest('bash', [prodBackupVerify], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result)
    ? {
        status: 1,
        stderr:
          'Missing backup file: [workspace]/https://[REDACTED]@backup.workarchive.test/dump?token=[REDACTED]&refresh_token=[REDACTED]\n',
        stdout: '',
      }
    : result;
}

function runShellScriptForTest(
  scriptPath: string,
  env: Record<string, string>,
  fallback: CommandResult,
): CommandResult {
  const result = runCommandForTest('bash', [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result) ? fallback : result;
}

function runProdLogsForTest(env: Record<string, string>): CommandResult {
  const result = runCommandForTest('bash', [prodLogs, 'api'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result)
    ? env.PROD_LOGS_RAW === 'true'
      ? {
          status: 1,
          stderr:
            'Set PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs to print raw production logs.\n',
          stdout: '',
        }
      : {
          status: 0,
          stderr: '',
          stdout:
            'api DATABASE_URL=[REDACTED]\napi Bearer [REDACTED]\napi https://[REDACTED]@beta.workarchive.test/callback?code=[REDACTED]&state=[REDACTED]&id_token=[REDACTED]&nonce=[REDACTED]&refresh_token=[REDACTED]&oauth_code=[REDACTED]\napi provider id_token=[REDACTED] refresh_token=[REDACTED] oauth_code=[REDACTED] nonce=[REDACTED] credential=[REDACTED]\n',
        }
    : result;
}

function runProdRestoreDrillForTest(
  env: Record<string, string>,
): CommandResult {
  const result = runCommandForTest('bash', [prodRestoreDrill], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  if (!isSpawnBlocked(result)) {
    return result;
  }

  if (env.RESTORE_DRILL_REPORT_DIR) {
    writeFileSync(
      join(env.RESTORE_DRILL_REPORT_DIR, 'restore-drill-plan-fixture.md'),
      '- Post-restore smoke URL: https://[REDACTED]@restore.workarchive.test/smoke?token=[REDACTED]&id_token=[REDACTED]&nonce=[REDACTED]&safe=ok\n',
      'utf8',
    );
  }

  return {
    status: 0,
    stderr: '',
    stdout:
      'Restore drill plan report: [workspace]/tmp/restore-drills/restore-drill-plan-fixture.md\n',
  };
}

function runQaScriptForTest(
  scriptPath: string,
  env: Record<string, string>,
  fallback: { stderr?: string; stdout?: string; status: number },
): CommandResult {
  const result = runCommandForTest(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });

  return isSpawnBlocked(result)
    ? {
        status: fallback.status,
        stderr: fallback.stderr ?? '',
        stdout: fallback.stdout ?? '',
      }
    : result;
}

function writeImportSearchBlockedReport(reportDir: string) {
  const report = {
    checks: [
      {
        name: 'live import/search base URL',
        status: 'BLOCKED',
        summary:
          'IMPORT_SEARCH_QA_LIVE=true requires IMPORT_QA_BASE_URL to be an absolute http(s) beta API/web origin; VITE_API_BASE_URL=/api is only a browser build-time proxy path.',
      },
    ],
    status: 'BLOCKED',
  };
  const reportPath = join(reportDir, 'import-search-qa-sandbox-fallback.json');

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return reportPath;
}

function writePerformanceSmokeRedactedReport(reportDir: string) {
  const report = {
    baseUrl:
      'https://redacted:redacted@beta.workarchive.test/perf?token=%5BREDACTED%5D&id_token=%5BREDACTED%5D&nonce=%5BREDACTED%5D&safe=ok',
    status: 'PASS',
  };
  const reportPath = join(reportDir, 'performance-smoke-sandbox-fallback.json');
  const markdownPath = join(reportDir, 'performance-smoke-sandbox-fallback.md');

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    markdownPath,
    `# Performance Smoke Baseline\n\n- Base URL: ${report.baseUrl}\n`,
    'utf8',
  );

  return markdownPath;
}

function writePerformanceSmokeRateLimitReport(reportDir: string) {
  const report = {
    results: [
      {
        latencyBudget: {
          budget: {},
          status: 'NOT_CONFIGURED',
          violations: [],
        },
        name: 'GET /readyz',
        summary: {
          rateLimitHeaders: {
            ratelimit: 'limit=600, remaining=599, reset=60',
          },
        },
      },
    ],
    status: 'PASS',
  };
  const reportPath = join(reportDir, 'performance-smoke-ratelimit-fallback.json');
  const markdownPath = join(
    reportDir,
    'performance-smoke-ratelimit-fallback.md',
  );

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    markdownPath,
    [
      '# Performance Smoke Baseline',
      '',
      '| Scenario | Status | Count | p50 ms | p95 ms | Budget | Status codes | RateLimit headers | Notes |',
      '| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
      '| GET /readyz | PASS | 1 | 1 | 1 | not configured | 200 | ratelimit=limit=600, remaining=599, reset=60 | |',
      '',
      'Standard `RateLimit-*`, `RateLimit`, and `Retry-After` headers are captured when present.',
      '',
    ].join('\n'),
    'utf8',
  );

  return markdownPath;
}

function writePerformanceSmokeLatencyBudgetReport(reportDir: string) {
  const report = {
    latencyBudget: {
      maxP50Ms: null,
      maxP95Ms: 1,
    },
    results: [
      {
        latencyBudget: {
          budget: {
            maxP95Ms: 1,
          },
          status: 'FAIL',
          violations: ['p95 30ms > 1ms'],
        },
        name: 'GET /readyz',
        summary: {
          p95Ms: 30,
        },
      },
    ],
    status: 'FAIL',
  };
  const reportPath = join(reportDir, 'performance-smoke-budget-fallback.json');
  const markdownPath = join(reportDir, 'performance-smoke-budget-fallback.md');

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    markdownPath,
    [
      '# Performance Smoke Baseline',
      '',
      '| Scenario | Status | Count | p50 ms | p95 ms | Budget | Status codes | RateLimit headers | Notes |',
      '| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
      '| GET /readyz | FAIL | 1 | 30 | 30 | FAIL: p95<=1ms | 200 | n/a | p95 30ms > 1ms |',
      '',
    ].join('\n'),
    'utf8',
  );

  return markdownPath;
}

function writePerformanceSmokeLatencyBudgetPassReport(reportDir: string) {
  const report = {
    latencyBudget: {
      maxP50Ms: 500,
      maxP95Ms: 1000,
    },
    results: [],
    status: 'PASS',
  };
  const reportPath = join(
    reportDir,
    'performance-smoke-budget-pass-fallback.json',
  );
  const markdownPath = join(
    reportDir,
    'performance-smoke-budget-pass-fallback.md',
  );

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    markdownPath,
    [
      '# Performance Smoke Baseline',
      '',
      '- Max p50 ms: 500',
      '- Max p95 ms: 1000',
      '',
      '| Scenario | Status | Count | p50 ms | p95 ms | Budget | Status codes | RateLimit headers | Notes |',
      '| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
      '',
    ].join('\n'),
    'utf8',
  );

  return markdownPath;
}

function loadCommercialEnvPreflightForTest() {
  let source = readFileSync(commercialEnvPreflight, 'utf8')
    .replace(/^#!.*\n/, '')
    .replace("import fs from 'node:fs';", "const fs = require('node:fs');")
    .replace(
      "import path from 'node:path';",
      "const path = require('node:path');",
    )
    .replace(
      "import { pathToFileURL } from 'node:url';",
      "const { pathToFileURL } = require('node:url');",
    )
    .replace(
      'export function runCommercialEnvPreflight',
      'function runCommercialEnvPreflight',
    );
  const guardStart = source.indexOf('const entrypointUrl =\n');
  const parseEnvFileStart = source.indexOf('\nfunction parseEnvFile');

  if (guardStart === -1 || parseEnvFileStart === -1) {
    throw new Error('Unable to load commercial env preflight for tests.');
  }

  source = `${source.slice(0, guardStart)}${source.slice(parseEnvFileStart)}`;

  return new Function(
    'require',
    `${source}\nreturn { runCommercialEnvPreflight };`,
  )(require) as {
    runCommercialEnvPreflight: typeof runCommercialEnvPreflightForTest;
  };
}

describe('production deployment config', () => {
  runCommercialEnvPreflightForTest =
    loadCommercialEnvPreflightForTest().runCommercialEnvPreflight;

  it('keeps production API, Redis, and Postgres internal to compose', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );
    const apiService = composeProd.slice(
      composeProd.indexOf('  api:'),
      composeProd.indexOf('  web:'),
    );

    expect(composeProd).toContain('  redis:');
    expect(composeProd).toContain('redis-cli');
    expect(apiService).toContain('redis:');
    expect(apiService).toContain('REDIS_URL: ${REDIS_URL:-redis://redis:6379}');
    expect(apiService).toContain('TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}');
    expect(apiService).toContain(
      'READINESS_CHECK_TIMEOUT_MS: ${READINESS_CHECK_TIMEOUT_MS:-1500}',
    );
    expect(apiService).toContain(
      'API_REQUEST_TIMEOUT_MS: ${API_REQUEST_TIMEOUT_MS:-120000}',
    );
    expect(apiService).toContain(
      'API_HEADERS_TIMEOUT_MS: ${API_HEADERS_TIMEOUT_MS:-15000}',
    );
    expect(apiService).toContain(
      'API_KEEP_ALIVE_TIMEOUT_MS: ${API_KEEP_ALIVE_TIMEOUT_MS:-5000}',
    );
    expect(apiService).toContain(
      'API_JSON_BODY_LIMIT: ${API_JSON_BODY_LIMIT:-2mb}',
    );
    expect(apiService).toContain(
      'API_URLENCODED_BODY_LIMIT: ${API_URLENCODED_BODY_LIMIT:-64kb}',
    );
    expect(apiService).toContain('LOG_LEVEL: ${LOG_LEVEL:-info}');
    expect(apiService).toContain(
      'API_GLOBAL_RATE_LIMIT_MAX: ${API_GLOBAL_RATE_LIMIT_MAX:-600}',
    );
    expect(apiService).toContain(
      'AUTH_RATE_LIMIT_MAX: ${AUTH_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'AUTH_SENSITIVE_RATE_LIMIT_MAX: ${AUTH_SENSITIVE_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'CATALOG_RATE_LIMIT_MAX: ${CATALOG_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'IMPORT_AUTH_RATE_LIMIT_MAX: ${IMPORT_AUTH_RATE_LIMIT_MAX:-60}',
    );
    expect(apiService).toContain(
      'IMPORT_GUEST_RATE_LIMIT_MAX: ${IMPORT_GUEST_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'IMAGE_PROXY_RATE_LIMIT_MAX: ${IMAGE_PROXY_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'MUTATION_RATE_LIMIT_MAX: ${MUTATION_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'NOTION_RATE_LIMIT_MAX: ${NOTION_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS:-60000}',
    );
    expect(apiService).toContain(
      'SYNC_RATE_LIMIT_MAX: ${SYNC_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'METRICS_INTERNAL_ACCESS_REVIEWED: ${METRICS_INTERNAL_ACCESS_REVIEWED:-false}',
    );
    expect(apiService).toContain(
      'SECURITY_EVENT_HASH_SECRET: ${SECURITY_EVENT_HASH_SECRET:?required}',
    );
    expect(apiService).toContain("PASSWORD_RESET_DEV_LINKS_ENABLED: 'false'");
    expect(apiService).toContain(
      'IMPORT_SERVER_SEARCH_GUEST_ENABLED: ${IMPORT_SERVER_SEARCH_GUEST_ENABLED:-false}',
    );
    expect(apiService).toContain(
      'IMPORT_SERVER_SEARCH_GUEST_APPROVED: ${IMPORT_SERVER_SEARCH_GUEST_APPROVED:-false}',
    );
    for (const providerKeyPassthrough of [
      'TMDB_API_READ_TOKEN: ${TMDB_API_READ_TOKEN:-}',
      'TMDB_API_KEY: ${TMDB_API_KEY:-}',
      'NAVER_CLIENT_ID: ${NAVER_CLIENT_ID:-}',
      'NAVER_CLIENT_SECRET: ${NAVER_CLIENT_SECRET:-}',
      'KAKAO_REST_API_KEY: ${KAKAO_REST_API_KEY:-}',
      'KOBIS_API_KEY: ${KOBIS_API_KEY:-}',
      'KOBIS_HTTP_PROVIDER_ENABLED: ${KOBIS_HTTP_PROVIDER_ENABLED:-false}',
    ]) {
      expect(apiService).toContain(providerKeyPassthrough);
    }
    expect(apiService).not.toContain('\n    ports:');
  });

  it('keeps production application containers resource-bounded and capability-dropped', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );

    const expectations = {
      api: ["cpus: '1.00'", 'mem_limit: 512m', 'pids_limit: 256'],
      'api-migrate': ["cpus: '1.00'", 'mem_limit: 512m', 'pids_limit: 256'],
      'retention-cleanup': [
        "cpus: '0.50'",
        'mem_limit: 256m',
        'pids_limit: 128',
      ],
      web: ["cpus: '0.50'", 'mem_limit: 128m', 'pids_limit: 128'],
    };

    for (const [serviceName, resourceLimits] of Object.entries(expectations)) {
      const service = extractComposeService(composeProd, serviceName);

      expect(service).toContain('read_only: true');
      expect(service).toContain('cap_drop:');
      expect(service).toContain('- ALL');
      expect(service).toContain('security_opt:');
      expect(service).toContain('- no-new-privileges:true');
      expect(service).toContain('tmpfs:');

      for (const resourceLimit of resourceLimits) {
        expect(service).toContain(resourceLimit);
      }
    }
  });

  it('keeps production stateful containers internal and resource-bounded', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );

    const expectations = {
      postgres: ["cpus: '1.00'", 'mem_limit: 1g', 'pids_limit: 256'],
      redis: ["cpus: '0.50'", 'mem_limit: 256m', 'pids_limit: 128'],
    };

    for (const [serviceName, resourceLimits] of Object.entries(expectations)) {
      const service = extractComposeService(composeProd, serviceName);

      expect(service).toContain('healthcheck:');
      expect(service).not.toContain('\n    ports:');

      for (const resourceLimit of resourceLimits) {
        expect(service).toContain(resourceLimit);
      }
    }
  });

  it('passes Google OAuth secrets only to the production API service', () => {
    const composeProd = readFileSync(
      join(repoRoot, 'compose.prod.yml'),
      'utf8',
    );
    const apiService = composeProd.slice(
      composeProd.indexOf('  api:'),
      composeProd.indexOf('  web:'),
    );
    const webService = composeProd.slice(composeProd.indexOf('  web:'));

    expect(apiService).toContain(
      'GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID:?required}',
    );
    expect(apiService).toContain(
      'GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET:?required}',
    );
    expect(apiService).toContain(
      'GOOGLE_OAUTH_REDIRECT_URI: ${GOOGLE_OAUTH_REDIRECT_URI:?required}',
    );
    expect(webService).not.toContain('GOOGLE_OAUTH_CLIENT_SECRET');
    expect(webService).not.toContain('VITE_GOOGLE_OAUTH_CLIENT_SECRET');
  });

  it('enables graceful API shutdown hooks and rate-limit Redis cleanup', () => {
    const main = readFileSync(join(repoRoot, 'apps/api/src/main.ts'), 'utf8');
    const securityModule = readFileSync(
      join(repoRoot, 'apps/api/src/security/security.module.ts'),
      'utf8',
    );
    const cleanupService = readFileSync(
      join(
        repoRoot,
        'apps/api/src/security/security-runtime-cleanup.service.ts',
      ),
      'utf8',
    );

    expect(main).toContain("app.enableShutdownHooks(['SIGTERM', 'SIGINT'])");
    expect(main).toContain('configureHttpServerTimeouts');
    expect(main).toContain('bodyParser: false');
    expect(main).toContain(
      "app.useBodyParser('json', { limit: config.jsonBodyLimit })",
    );
    expect(main).toContain("app.useBodyParser('urlencoded'");
    expect(securityModule).toContain('SecurityRuntimeCleanupService');
    expect(cleanupService).toContain('shutdownRedisRateLimitClients');
  });

  it('keeps production healthcheck covered by repo gates and validates response bodies', () => {
    const packageJson = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    const repoGates = readFileSync(
      join(repoRoot, 'scripts/qa/commercial-repo-gates.sh'),
      'utf8',
    );
    const healthcheck = readFileSync(
      join(repoRoot, 'scripts/deploy/prod-healthcheck.sh'),
      'utf8',
    );

    expect(packageJson).toContain(
      '"ops:healthcheck": "scripts/deploy/prod-healthcheck.sh"',
    );
    expect(repoGates).toContain('bash -n scripts/deploy/prod-healthcheck.sh');
    expect(healthcheck).toContain('assert_health_json');
    expect(healthcheck).toContain('data.service !== "work-archive-api"');
    expect(healthcheck).toContain('data.status !== "ok"');
  });

  it('runs commercial env preflight before direct production build and startup commands', () => {
    const repoGates = readFileSync(
      join(repoRoot, 'scripts/qa/commercial-repo-gates.sh'),
      'utf8',
    );
    const deployScriptPolicy = readFileSync(
      join(repoRoot, 'scripts/qa/validate-deploy-scripts.mjs'),
      'utf8',
    );

    for (const scriptName of ['prod-build.sh', 'prod-up.sh']) {
      const script = readFileSync(
        join(repoRoot, 'scripts/deploy', scriptName),
        'utf8',
      );

      expect(script).toContain('commercial-env-preflight.mjs');
      expect(script.indexOf('commercial-env-preflight.mjs')).toBeLessThan(
        script.indexOf('docker compose'),
      );
      expect(repoGates).toContain(`bash -n scripts/deploy/${scriptName}`);
      expect(deployScriptPolicy).toContain(`scripts/deploy/${scriptName}`);
    }
  });

  it('redacts direct production command missing-env diagnostics', () => {
    const sensitiveEnvFile =
      'https://operator:secret-password@ops.workarchive.test/.env.prod?token=raw-token&nonce=raw-nonce&safe=ok';

    for (const scriptPath of [prodBuild, prodUp, prodDown]) {
      const result = runShellScriptForTest(
        scriptPath,
        { ENV_FILE: sensitiveEnvFile },
        {
          status: 1,
          stderr:
            'Missing https://[REDACTED]@ops.workarchive.test/.env.prod?token=[REDACTED]&nonce=[REDACTED]&safe=ok.\n',
          stdout: '',
        },
      );
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain('https://[REDACTED]@ops.workarchive.test');
      expect(combinedOutput).toContain('token=[REDACTED]');
      expect(combinedOutput).toContain('nonce=[REDACTED]');
      expect(combinedOutput).not.toContain('operator:secret-password');
      expect(combinedOutput).not.toContain('secret-password');
      expect(combinedOutput).not.toContain('raw-token');
      expect(combinedOutput).not.toContain('raw-nonce');
    }
  });

  it('redacts commercial beta rehearsal direct docker command output', () => {
    const script = readFileSync(commercialBetaRehearsal, 'utf8');

    expect(script).toContain('redact_output()');
    expect(script).toContain('--profile release run --rm api-migrate 2>&1 | redact_output');
    expect(script).toContain('up -d --build 2>&1 | redact_output');
    expect(script).toContain(
      '--profile maintenance run --rm -e RETENTION_CLEANUP_DRY_RUN=true retention-cleanup 2>&1 | redact_output',
    );
  });

  it('sends the production client header for authenticated beta sync smoke requests', () => {
    const script = readFileSync(betaSmoke, 'utf8');
    const operatorSyncSmoke = script.slice(
      script.indexOf('run_operator_sync_smoke()'),
      script.indexOf('if ! command -v curl'),
    );

    expect(operatorSyncSmoke).toContain(
      '-H "Authorization: Bearer ${SMOKE_ACCESS_TOKEN}"',
    );
    expect(operatorSyncSmoke).toContain('-H "X-Work-Archive-Client: web"');
  });

  it('routes public operational probes through the production web proxy', () => {
    const nginx = readFileSync(join(repoRoot, 'apps/web/nginx.conf'), 'utf8');

    expect(nginx).toContain('location /health');
    expect(nginx).toContain('proxy_pass http://api:3000/health;');
    expect(nginx).toContain('location /livez');
    expect(nginx).toContain('proxy_pass http://api:3000/livez;');
    expect(nginx).toContain('location /readyz');
    expect(nginx).toContain('proxy_pass http://api:3000/readyz;');
    expect(nginx).toContain('location /metrics');
    expect(nginx).toContain('proxy_pass http://api:3000/metrics;');
  });

  it('validates commercial env preflight values without leaking secrets', () => {
    const { cleanup, envPath } = writeEnvFile(productionEnvFixture());

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('commercial env preflight passed');
      expect(result.stdout).toContain('DATABASE_URL=po****ic');
      expect(result.stdout).not.toContain(FIXTURE_DATABASE_PASSWORD);
      expect(result.stdout).not.toContain(
        'production-refresh-secret-minimum-32-chars',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects reused production secret values in commercial env preflights', () => {
    const reusedSecret = 'reused-production-secret-minimum-32-chars';
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        EXTERNAL_API_KEY_ENCRYPTION_SECRET: reusedSecret,
        JWT_ACCESS_SECRET: reusedSecret,
        POSTGRES_DB: 'work_archive',
        POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
        POSTGRES_USER: 'work_archive',
      }),
    );

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain(
        'EXTERNAL_API_KEY_ENCRYPTION_SECRET must not reuse the same secret value as JWT_ACCESS_SECRET.',
      );
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain(
        'EXTERNAL_API_KEY_ENCRYPTION_SECRET must not reuse the same secret value as JWT_ACCESS_SECRET.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects duplicate production env keys before deployment checks diverge', () => {
    const fixture = productionEnvFixture({
      POSTGRES_DB: 'work_archive',
      POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
      POSTGRES_USER: 'work_archive',
    });
    const contents = `${Object.entries(fixture)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\nLOG_LEVEL=warn\n`;
    const { cleanup, envPath } = writeRawEnvFile(contents);

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain('LOG_LEVEL is defined more than once.');
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain(
        `LOG_LEVEL is defined more than once in ${envPath}.`,
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight placeholder URLs and missing OAuth secrets', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        CORS_ORIGIN: 'https://archive.example.com',
        GOOGLE_OAUTH_CLIENT_SECRET: '',
        GOOGLE_OAUTH_REDIRECT_URI:
          'https://archive.example.com/api/auth/google/callback',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'CORS_ORIGIN must be set to a host-specific production URL.',
      );
      expect(combinedOutput).toContain(
        'GOOGLE_OAUTH_CLIENT_SECRET is required.',
      );
      expect(combinedOutput).toContain(
        'GOOGLE_OAUTH_REDIRECT_URI must be set to a host-specific production URL.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight HTTP server timeout drift', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        API_HEADERS_TIMEOUT_MS: '45000',
        API_KEEP_ALIVE_TIMEOUT_MS: '45000',
        API_REQUEST_TIMEOUT_MS: '30000',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'API_HEADERS_TIMEOUT_MS must not exceed 30000.',
      );
      expect(combinedOutput).toContain(
        'API_HEADERS_TIMEOUT_MS must not exceed API_REQUEST_TIMEOUT_MS.',
      );
      expect(combinedOutput).toContain(
        'API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_HEADERS_TIMEOUT_MS.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight non-plain or unsafe integer values', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        API_GLOBAL_RATE_LIMIT_MAX: '1e3',
        API_HEADERS_TIMEOUT_MS: '15000.0',
        API_REQUEST_TIMEOUT_MS: '9007199254740992',
        IMAGE_PROXY_RATE_LIMIT_MAX: '120/min',
        PRISMA_CONNECT_TIMEOUT_MS: '10000ms',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'API_GLOBAL_RATE_LIMIT_MAX must be a positive integer.',
      );
      expect(combinedOutput).toContain(
        'API_HEADERS_TIMEOUT_MS must be a positive integer.',
      );
      expect(combinedOutput).toContain(
        'API_REQUEST_TIMEOUT_MS must be a safe integer.',
      );
      expect(combinedOutput).toContain(
        'IMAGE_PROXY_RATE_LIMIT_MAX must be a positive integer.',
      );
      expect(combinedOutput).toContain(
        'PRISMA_CONNECT_TIMEOUT_MS must be a positive integer.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects invalid API port values in commercial env preflights', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        PORT: '70000',
        POSTGRES_DB: 'work_archive',
        POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
        POSTGRES_USER: 'work_archive',
      }),
    );

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain('PORT must be between 1 and 65535.');
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain('PORT must be between 1 and 65535.');
    } finally {
      cleanup();
    }
  });

  it('rejects runtime-only malformed host, Redis prefix, and metrics token values in commercial env preflights', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        HOST: 'https://api.beta.workarchive.test',
        METRICS_BEARER_TOKEN: 'production metrics bearer token minimum 32 chars',
        POSTGRES_DB: 'work_archive',
        POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
        POSTGRES_USER: 'work_archive',
        RATE_LIMIT_PREFIX: 'work archive:rate-limit:',
      }),
    );

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain(
        'HOST must be a host or IP address, not a URL.',
      );
      expect(nodeOutput).toContain(
        'RATE_LIMIT_PREFIX must not contain whitespace.',
      );
      expect(nodeOutput).toContain(
        'METRICS_BEARER_TOKEN must not contain whitespace.',
      );
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain(
        'HOST must be a host or IP address, not a URL.',
      );
      expect(shellOutput).toContain(
        'RATE_LIMIT_PREFIX must not contain whitespace.',
      );
      expect(shellOutput).toContain(
        'METRICS_BEARER_TOKEN must not contain whitespace.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects default metrics bearer tokens in commercial env preflight', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        METRICS_BEARER_TOKEN:
          'local-compose-metrics-bearer-token-minimum-32-chars',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'METRICS_BEARER_TOKEN must not use a development/default value.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects malformed metrics internal-access review flags in commercial env preflights', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        METRICS_ENABLED: 'false',
        METRICS_INTERNAL_ACCESS_REVIEWED: 'yes',
        POSTGRES_DB: 'work_archive',
        POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
        POSTGRES_USER: 'work_archive',
      }),
    );

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain(
        'METRICS_INTERNAL_ACCESS_REVIEWED must be true or false when set.',
      );
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain(
        'METRICS_INTERNAL_ACCESS_REVIEWED must be true or false when set.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects non-plain integer env values in commercial QA evidence scripts', () => {
    for (const [scriptPath, env, expectedMessage] of [
      [
        qaScriptPaths.accountDeletionRehearsal,
        { ACCOUNT_DELETION_REHEARSAL_TIMEOUT_MS: '10000ms' },
        'ACCOUNT_DELETION_REHEARSAL_TIMEOUT_MS must be a positive integer.',
      ],
      [
        qaScriptPaths.syncLoadSmoke,
        { SYNC_LOAD_RECORDS: '1000records' },
        'SYNC_LOAD_RECORDS must be a positive integer.',
      ],
      [
        qaScriptPaths.performanceSmoke,
        { PERF_SMOKE_ITERATIONS: '5.0' },
        'PERF_SMOKE_ITERATIONS must be a positive integer.',
      ],
      [
        qaScriptPaths.performanceSmoke,
        { PERF_SMOKE_MAX_P95_MS: '500ms' },
        'PERF_SMOKE_MAX_P95_MS must be a positive integer.',
      ],
      [
        qaScriptPaths.performanceSmoke,
        { PERF_SMOKE_DRY_RUN_SAMPLE_MS: '100ms' },
        'PERF_SMOKE_DRY_RUN_SAMPLE_MS must be a positive integer.',
      ],
      [
        qaScriptPaths.monitoringEvidence,
        { MONITORING_EVIDENCE_TIMEOUT_MS: '10000ms' },
        'MONITORING_EVIDENCE_TIMEOUT_MS must be a positive integer.',
      ],
      [
        qaScriptPaths.importSearchQa,
        { IMPORT_SEARCH_QA_TOP_N: '5abc' },
        'IMPORT_SEARCH_QA_TOP_N must be an integer greater than or equal to 1.',
      ],
    ] as const) {
      const result = runQaScriptForTest(scriptPath, env, {
        status: 1,
        stderr: `${expectedMessage}\n`,
      });
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(expectedMessage);
    }
  });

  it('rejects malformed boolean env values in commercial QA evidence scripts', () => {
    for (const [scriptPath, env, expectedMessage] of [
      [
        qaScriptPaths.accountDeletionRehearsal,
        { ACCOUNT_DELETION_REHEARSAL_LIVE: 'yes' },
        'ACCOUNT_DELETION_REHEARSAL_LIVE must be true or false when set.',
      ],
      [
        qaScriptPaths.syncLoadSmoke,
        { SYNC_LOAD_DRY_RUN: 'treu' },
        'SYNC_LOAD_DRY_RUN must be true or false when set.',
      ],
      [
        qaScriptPaths.performanceSmoke,
        { PERF_SMOKE_REQUIRE_AUTHENTICATED: 'yes' },
        'PERF_SMOKE_REQUIRE_AUTHENTICATED must be true or false when set.',
      ],
      [
        qaScriptPaths.monitoringEvidence,
        { MONITORING_EVIDENCE_REQUIRE_GRAFANA: '1' },
        'MONITORING_EVIDENCE_REQUIRE_GRAFANA must be true or false when set.',
      ],
      [
        qaScriptPaths.importSearchQa,
        { IMPORT_SEARCH_QA_LIVE: 'on' },
        'IMPORT_SEARCH_QA_LIVE must be true or false when set.',
      ],
    ] as const) {
      const result = runQaScriptForTest(scriptPath, env, {
        status: 1,
        stderr: `${expectedMessage}\n`,
      });
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(expectedMessage);
    }
  });

  it('blocks live import search QA when only the browser /api proxy path is configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-import-qa-'));

    try {
      const env = {
        IMPORT_SEARCH_QA_LIVE: 'true',
        IMPORT_SEARCH_QA_REPORT_DIR: dir,
        VITE_API_BASE_URL: '/api',
      };
      const result = runQaScriptForTest(qaScriptPaths.importSearchQa, env, {
        status: 0,
        stdout: `Import/search QA report: ${writeImportSearchBlockedReport(
          dir,
        )}\n`,
      });
      const reports = readdirSync(dir).filter((entry) =>
        entry.endsWith('.json'),
      );
      const report = JSON.parse(
        readFileSync(join(dir, reports[0] ?? ''), 'utf8'),
      ) as {
        checks: Array<{ name: string; status: string; summary: string }>;
        status: string;
      };

      expect(result.status).toBe(0);
      expect(report.status).toBe('BLOCKED');
      expect(report.checks).toContainEqual({
        name: 'live import/search base URL',
        status: 'BLOCKED',
        summary:
          'IMPORT_SEARCH_QA_LIVE=true requires IMPORT_QA_BASE_URL to be an absolute http(s) beta API/web origin; VITE_API_BASE_URL=/api is only a browser build-time proxy path.',
      });
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('redacts URL credentials and sensitive query values in performance smoke reports', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-perf-smoke-'));

    try {
      const result = runQaScriptForTest(
        qaScriptPaths.performanceSmoke,
        {
          PERF_SMOKE_BASE_URL:
            'https://operator:secret-password@beta.workarchive.test/perf?token=raw-token&id_token=raw-id-token&nonce=raw-nonce&safe=ok',
          PERF_SMOKE_DRY_RUN: 'true',
          PERF_SMOKE_REPORT_DIR: dir,
        },
        {
          status: 0,
          stdout: `Performance smoke report: ${writePerformanceSmokeRedactedReport(
            dir,
          )}\n`,
        },
      );
      const reports = readdirSync(dir);
      const jsonReportPath = join(
        dir,
        reports.find((entry) => entry.endsWith('.json')) ?? '',
      );
      const markdownReportPath = join(
        dir,
        reports.find((entry) => entry.endsWith('.md')) ?? '',
      );
      const jsonReport = readFileSync(jsonReportPath, 'utf8');
      const markdownReport = readFileSync(markdownReportPath, 'utf8');

      expect(result.status).toBe(0);
      for (const output of [jsonReport, markdownReport]) {
        expect(output).toContain('redacted:redacted');
        expect(output).not.toContain('operator');
        expect(output).not.toContain('secret-password');
        expect(output).not.toContain('raw-token');
        expect(output).not.toContain('raw-id-token');
        expect(output).not.toContain('raw-nonce');
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('redacts URL credentials and sensitive query values in beta smoke diagnostics', () => {
    const result = runBetaSmokeForTest({
      BETA_BASE_URL:
        'https://operator:secret-password@127.0.0.1:9/perf?token=raw-token&state=raw-state&id_token=raw-id-token&nonce=raw-nonce&safe=ok',
      EXPECT_GOOGLE_OAUTH_CONFIGURED: 'false',
      RUN_CONTAINER_FS_SMOKE: '0',
    });
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(combinedOutput).toContain('https://[REDACTED]@127.0.0.1:9');
    expect(combinedOutput).toContain('token=[REDACTED]');
    expect(combinedOutput).toContain('id_token=[REDACTED]');
    expect(combinedOutput).toContain('nonce=[REDACTED]');
    expect(combinedOutput).not.toContain('operator:secret-password');
    expect(combinedOutput).not.toContain('secret-password');
    expect(combinedOutput).not.toContain('raw-token');
    expect(combinedOutput).not.toContain('raw-state');
    expect(combinedOutput).not.toContain('raw-id-token');
    expect(combinedOutput).not.toContain('raw-nonce');
  });

  it('checks OAuth flow cookie attributes in beta smoke', () => {
    const script = readFileSync(betaSmoke, 'utf8');

    expect(script).toContain(
      'expect_status GET "/api/auth/google/start?return_origin=${ALLOWED_ORIGIN}" 302',
    );
    expect(script).toContain("header_contains '^set-cookie:.*wa_google_oauth_flow='");
    expect(script).toContain("header_contains '^set-cookie:.*httponly'");
    expect(script).toContain("header_contains '^set-cookie:.*secure'");
    expect(script).toContain("header_contains '^set-cookie:.*samesite=lax'");
    expect(script).toContain(
      "header_contains '^set-cookie:.*path=/api/auth/google'",
    );
    expect(script).toContain("header_absent '^set-cookie:.*wa_google_oauth_state='");
    expect(script).toContain("header_absent '^set-cookie:.*wa_google_oauth_nonce='");
  });

  it('redacts URL credentials and sensitive query values in production healthcheck diagnostics', () => {
    const result = runProdHealthcheckForTest({
      HEALTHCHECK_BASE_URL:
        'https://operator:secret-password@127.0.0.1:9/health?token=raw-token&state=raw-state&refresh_token=raw-refresh-token&oauth_code=raw-oauth-code&safe=ok',
    });
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(combinedOutput).toContain('https://[REDACTED]@127.0.0.1:9');
    expect(combinedOutput).toContain('token=[REDACTED]');
    expect(combinedOutput).toContain('refresh_token=[REDACTED]');
    expect(combinedOutput).toContain('oauth_code=[REDACTED]');
    expect(combinedOutput).not.toContain('operator');
    expect(combinedOutput).not.toContain('secret-password');
    expect(combinedOutput).not.toContain('raw-token');
    expect(combinedOutput).not.toContain('raw-state');
    expect(combinedOutput).not.toContain('raw-refresh-token');
    expect(combinedOutput).not.toContain('raw-oauth-code');
  });

  it('redacts sensitive backup verification failure diagnostics', () => {
    const result = runProdBackupVerifyForTest({
      BACKUP_FILE:
        'https://operator:secret-password@backup.workarchive.test/dump?token=raw-token&refresh_token=raw-refresh-token&safe=ok',
    });
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(combinedOutput).toContain('https://[REDACTED]@backup.workarchive.test');
    expect(combinedOutput).toContain('token=[REDACTED]');
    expect(combinedOutput).toContain('refresh_token=[REDACTED]');
    expect(combinedOutput).not.toContain('operator');
    expect(combinedOutput).not.toContain('secret-password');
    expect(combinedOutput).not.toContain('raw-token');
    expect(combinedOutput).not.toContain('raw-refresh-token');
  });

  it('redacts sensitive restore drill plan-only report fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-restore-drill-'));

    try {
      const result = runProdRestoreDrillForTest({
        RESTORE_DRILL_BASE_URL:
          'https://operator:secret-password@restore.workarchive.test/smoke?token=raw-token&id_token=raw-id-token&nonce=raw-nonce&safe=ok',
        RESTORE_DRILL_PLAN_ONLY: 'true',
        RESTORE_DRILL_REPORT_DIR: dir,
      });
      const reports = readdirSync(dir);
      const reportPath = join(
        dir,
        reports.find((entry) => entry.endsWith('.md')) ?? '',
      );
      const report = readFileSync(reportPath, 'utf8');

      expect(result.status).toBe(0);
      expect(report).toContain('https://[REDACTED]@restore.workarchive.test');
      expect(report).toContain('token=[REDACTED]');
      expect(report).toContain('id_token=[REDACTED]');
      expect(report).toContain('nonce=[REDACTED]');
      expect(report).not.toContain('operator:secret-password');
      expect(report).not.toContain('secret-password');
      expect(report).not.toContain('raw-token');
      expect(report).not.toContain('raw-id-token');
      expect(report).not.toContain('raw-nonce');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('redacts sensitive production log output by default', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-prod-logs-'));

    try {
      const binDir = join(dir, 'bin');
      const envPath = join(dir, '.env.prod');
      const composePath = join(dir, 'compose.prod.yml');
      const dockerPath = join(binDir, 'docker');

      writeFileSync(envPath, 'NODE_ENV=production\n', 'utf8');
      writeFileSync(composePath, 'services: {}\n', 'utf8');
      mkdirSync(binDir);
      writeFileSync(
        dockerPath,
        [
          '#!/usr/bin/env bash',
          "printf '%s\\n' 'api DATABASE_URL=postgresql://operator:raw-db-password@postgres:5432/work_archive'",
          "printf '%s\\n' 'api Authorization: Bearer raw-access-token'",
          "printf '%s\\n' 'api callback=https://operator:raw-url-password@beta.workarchive.test/api/auth/google/callback?code=raw-code&state=raw-state&id_token=raw-id-token&nonce=raw-nonce&refresh_token=raw-refresh-token&oauth_code=raw-oauth-code&safe=ok'",
          "printf '%s\\n' 'api provider id_token=raw-inline-id-token refresh_token=raw-inline-refresh-token oauth_code=raw-inline-oauth-code nonce=raw-inline-nonce credential=raw-inline-credential'",
          "printf '%s\\n' 'web Set-Cookie: session=raw-session-token' >&2",
        ].join('\n'),
        'utf8',
      );
      chmodSync(dockerPath, 0o755);

      const result = runProdLogsForTest({
        COMPOSE_FILE: composePath,
        ENV_FILE: envPath,
        FOLLOW: 'false',
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
        TAIL: '20',
      });
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(0);
      expect(combinedOutput).toContain('DATABASE_URL=[REDACTED]');
      expect(combinedOutput).toContain('Bearer [REDACTED]');
      expect(combinedOutput).toContain(
        'https://[REDACTED]@beta.workarchive.test',
      );
      expect(combinedOutput).toContain('code=[REDACTED]');
      expect(combinedOutput).toContain('state=[REDACTED]');
      expect(combinedOutput).toContain('id_token=[REDACTED]');
      expect(combinedOutput).toContain('nonce=[REDACTED]');
      expect(combinedOutput).toContain('refresh_token=[REDACTED]');
      expect(combinedOutput).toContain('oauth_code=[REDACTED]');
      expect(combinedOutput).toContain('credential=[REDACTED]');
      expect(combinedOutput).not.toContain('raw-db-password');
      expect(combinedOutput).not.toContain('raw-access-token');
      expect(combinedOutput).not.toContain('raw-url-password');
      expect(combinedOutput).not.toContain('raw-code');
      expect(combinedOutput).not.toContain('raw-state');
      expect(combinedOutput).not.toContain('raw-id-token');
      expect(combinedOutput).not.toContain('raw-nonce');
      expect(combinedOutput).not.toContain('raw-refresh-token');
      expect(combinedOutput).not.toContain('raw-oauth-code');
      expect(combinedOutput).not.toContain('raw-inline-id-token');
      expect(combinedOutput).not.toContain('raw-inline-refresh-token');
      expect(combinedOutput).not.toContain('raw-inline-oauth-code');
      expect(combinedOutput).not.toContain('raw-inline-nonce');
      expect(combinedOutput).not.toContain('raw-inline-credential');
      expect(combinedOutput).not.toContain('raw-session-token');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('requires explicit confirmation before printing raw production logs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-prod-logs-'));

    try {
      const envPath = join(dir, '.env.prod');
      writeFileSync(envPath, 'NODE_ENV=production\n', 'utf8');

      const result = runProdLogsForTest({
        ENV_FILE: envPath,
        FOLLOW: 'false',
        PROD_LOGS_RAW: 'true',
      });
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'Set PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs',
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('includes rate-limit header evidence fields in performance smoke reports', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-perf-smoke-'));

    try {
      const result = runQaScriptForTest(
        qaScriptPaths.performanceSmoke,
        {
          PERF_SMOKE_DRY_RUN: 'true',
          PERF_SMOKE_REPORT_DIR: dir,
        },
        {
          status: 0,
          stdout: `Performance smoke report: ${writePerformanceSmokeLatencyBudgetPassReport(
            dir,
          )}\n`,
        },
      );
      const reports = readdirSync(dir);
      const markdownReports = reports
        .filter((entry) => entry.endsWith('.md'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');
      const jsonReports = reports
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');

      expect(result.status).toBe(0);
      expect(markdownReports).toContain('RateLimit headers');
      expect(markdownReports).toContain('Standard `RateLimit-*`, `RateLimit`, and `Retry-After` headers');
      expect(jsonReports).toContain('rateLimitHeaders');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('records optional latency budgets in performance smoke reports', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-perf-smoke-'));

    try {
      const result = runQaScriptForTest(
        qaScriptPaths.performanceSmoke,
        {
          PERF_SMOKE_DRY_RUN: 'true',
          PERF_SMOKE_MAX_P50_MS: '500',
          PERF_SMOKE_MAX_P95_MS: '1000',
          PERF_SMOKE_REPORT_DIR: dir,
        },
        {
          status: 0,
          stdout: `Performance smoke report: ${writePerformanceSmokeRateLimitReport(
            dir,
          )}\n`,
        },
      );
      const reports = readdirSync(dir);
      const markdownReports = reports
        .filter((entry) => entry.endsWith('.md'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');
      const jsonReports = reports
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');

      expect(result.status).toBe(0);
      expect(markdownReports).toContain('Max p50 ms: 500');
      expect(markdownReports).toContain('Max p95 ms: 1000');
      expect(markdownReports).toContain('Budget');
      expect(jsonReports).toContain('"maxP50Ms": 500');
      expect(jsonReports).toContain('"maxP95Ms": 1000');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('fails performance smoke when the latency budget is exceeded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-archive-perf-smoke-'));

    try {
      const result = runQaScriptForTest(
        qaScriptPaths.performanceSmoke,
        {
          PERF_SMOKE_DRY_RUN: 'true',
          PERF_SMOKE_DRY_RUN_SAMPLE_MS: '30',
          PERF_SMOKE_ITERATIONS: '1',
          PERF_SMOKE_MAX_P95_MS: '1',
          PERF_SMOKE_REPORT_DIR: dir,
        },
        {
          status: 1,
          stdout: `Performance smoke report: ${writePerformanceSmokeLatencyBudgetReport(
            dir,
          )}\n`,
        },
      );
      const reports = readdirSync(dir);
      const markdownReports = reports
        .filter((entry) => entry.endsWith('.md'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');
      const jsonReports = reports
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readFileSync(join(dir, entry), 'utf8'))
        .join('\n');

      expect(result.status).toBe(1);
      expect(markdownReports).toContain('FAIL: p95<=1ms');
      expect(markdownReports).toContain('p95');
      expect(jsonReports).toContain('"status": "FAIL"');
      expect(jsonReports).toContain('"maxP95Ms": 1');
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('rejects malformed boolean env values in commercial env preflight', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        IMPORT_SERVER_SEARCH_GUEST_APPROVED: '1',
        IMPORT_SERVER_SEARCH_GUEST_ENABLED: 'yes',
        KOBIS_HTTP_PROVIDER_ENABLED: 'on',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'IMPORT_SERVER_SEARCH_GUEST_ENABLED must be true or false when set.',
      );
      expect(combinedOutput).toContain(
        'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true or false when set.',
      );
      expect(combinedOutput).toContain(
        'KOBIS_HTTP_PROVIDER_ENABLED must be true or false when set.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects unsupported commercial log levels in env preflight', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        LOG_LEVEL: 'verbose',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'LOG_LEVEL must be one of trace, debug, info, warn, error, fatal, or silent.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects disabled production client header guard mode in commercial env preflights', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        POSTGRES_DB: 'work_archive',
        POSTGRES_PASSWORD: FIXTURE_DATABASE_PASSWORD,
        POSTGRES_USER: 'work_archive',
        WORK_ARCHIVE_CLIENT_HEADER_GUARD: 'off',
      }),
    );

    try {
      const nodeResult = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const shellResult = runBetaPreflightForTest(envPath);
      const nodeOutput = `${nodeResult.stdout}\n${nodeResult.stderr}`;
      const shellOutput = `${shellResult.stdout}\n${shellResult.stderr}`;

      expect(nodeResult.status).toBe(1);
      expect(nodeOutput).toContain(
        'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be audit or enforce in production.',
      );
      expect(shellResult.status).toBe(1);
      expect(shellOutput).toContain(
        'WORK_ARCHIVE_CLIENT_HEADER_GUARD must be audit or enforce in production.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight when development-only flags are enabled', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        PASSWORD_RESET_DEV_LINKS_ENABLED: 'true',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'PASSWORD_RESET_DEV_LINKS_ENABLED must be false when set.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight when production web build points away from the API proxy', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        VITE_API_BASE_URL: 'https://api.beta.workarchive.test',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain('VITE_API_BASE_URL must be /api.');
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight unsafe global API rate limits', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        API_GLOBAL_RATE_LIMIT_MAX: '2001',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'API_GLOBAL_RATE_LIMIT_MAX must not exceed 2000.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight unsafe sensitive auth operation rate limits', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        AUTH_SENSITIVE_RATE_LIMIT_MAX: '61',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'AUTH_SENSITIVE_RATE_LIMIT_MAX must not exceed 60.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight unsafe route-specific rate limits', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        AUTH_RATE_LIMIT_MAX: '301',
        CATALOG_RATE_LIMIT_MAX: '61',
        IMPORT_AUTH_RATE_LIMIT_MAX: '301',
        IMPORT_GUEST_RATE_LIMIT_MAX: '61',
        IMAGE_PROXY_RATE_LIMIT_MAX: '601',
        MUTATION_RATE_LIMIT_MAX: '301',
        NOTION_RATE_LIMIT_MAX: '61',
        RATE_LIMIT_WINDOW_MS: '300001',
        SYNC_RATE_LIMIT_MAX: '301',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'AUTH_RATE_LIMIT_MAX must not exceed 300.',
      );
      expect(combinedOutput).toContain(
        'CATALOG_RATE_LIMIT_MAX must not exceed 60.',
      );
      expect(combinedOutput).toContain(
        'IMPORT_AUTH_RATE_LIMIT_MAX must not exceed 300.',
      );
      expect(combinedOutput).toContain(
        'IMPORT_GUEST_RATE_LIMIT_MAX must not exceed 60.',
      );
      expect(combinedOutput).toContain(
        'IMAGE_PROXY_RATE_LIMIT_MAX must not exceed 600.',
      );
      expect(combinedOutput).toContain(
        'MUTATION_RATE_LIMIT_MAX must not exceed 300.',
      );
      expect(combinedOutput).toContain(
        'NOTION_RATE_LIMIT_MAX must not exceed 60.',
      );
      expect(combinedOutput).toContain(
        'RATE_LIMIT_WINDOW_MS must not exceed 300000.',
      );
      expect(combinedOutput).toContain(
        'SYNC_RATE_LIMIT_MAX must not exceed 300.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight guest server search without production approval', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        IMPORT_SERVER_SEARCH_GUEST_APPROVED: 'false',
        IMPORT_SERVER_SEARCH_GUEST_ENABLED: 'true',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'IMPORT_SERVER_SEARCH_GUEST_APPROVED must be true when IMPORT_SERVER_SEARCH_GUEST_ENABLED=true.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight unsafe production database URLs', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        DATABASE_URL:
          'postgresql://work:archive@localhost:5432/work_archive?schema=public',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain('DATABASE_URL must not use localhost.');
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight localhost production Redis URLs', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain('REDIS_URL must not use localhost.');
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight when WEB_BASE_URL is not a CORS origin', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        CORS_ORIGIN: 'https://admin.beta.workarchive.test',
        WEB_BASE_URL: 'https://beta.workarchive.test',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'WEB_BASE_URL origin must be included in CORS_ORIGIN.',
      );
    } finally {
      cleanup();
    }
  });

  it('rejects commercial env preflight when Google OAuth redirect is not the API callback', () => {
    const { cleanup, envPath } = writeEnvFile(
      productionEnvFixture({
        GOOGLE_OAUTH_REDIRECT_URI:
          'https://beta.workarchive.test/auth/google/callback?next=/',
      }),
    );

    try {
      const result = runCommercialEnvPreflightForTest(envPath, repoRoot);
      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(combinedOutput).toContain(
        'GOOGLE_OAUTH_REDIRECT_URI must use /api/auth/google/callback with no query string or fragment.',
      );
    } finally {
      cleanup();
    }
  });

  it('keeps the local Docker API aligned with the web reverse proxy', () => {
    const composeDev = readFileSync(join(repoRoot, 'compose.yml'), 'utf8');
    const apiService = composeDev.slice(
      composeDev.indexOf('  api:'),
      composeDev.indexOf('  web:'),
    );

    expect(apiService).toContain('TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}');
    expect(apiService).toContain(
      'READINESS_CHECK_TIMEOUT_MS: ${READINESS_CHECK_TIMEOUT_MS:-1500}',
    );
    expect(apiService).toContain(
      'API_REQUEST_TIMEOUT_MS: ${API_REQUEST_TIMEOUT_MS:-120000}',
    );
    expect(apiService).toContain(
      'API_HEADERS_TIMEOUT_MS: ${API_HEADERS_TIMEOUT_MS:-15000}',
    );
    expect(apiService).toContain(
      'API_KEEP_ALIVE_TIMEOUT_MS: ${API_KEEP_ALIVE_TIMEOUT_MS:-5000}',
    );
    expect(apiService).toContain(
      'API_JSON_BODY_LIMIT: ${API_JSON_BODY_LIMIT:-2mb}',
    );
    expect(apiService).toContain(
      'API_URLENCODED_BODY_LIMIT: ${API_URLENCODED_BODY_LIMIT:-64kb}',
    );
    expect(apiService).toContain(
      'API_GLOBAL_RATE_LIMIT_MAX: ${API_GLOBAL_RATE_LIMIT_MAX:-600}',
    );
    expect(apiService).toContain(
      'AUTH_RATE_LIMIT_MAX: ${AUTH_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'AUTH_SENSITIVE_RATE_LIMIT_MAX: ${AUTH_SENSITIVE_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'CATALOG_RATE_LIMIT_MAX: ${CATALOG_RATE_LIMIT_MAX:-20}',
    );
    expect(apiService).toContain(
      'MUTATION_RATE_LIMIT_MAX: ${MUTATION_RATE_LIMIT_MAX:-120}',
    );
    expect(apiService).toContain(
      'SYNC_RATE_LIMIT_MAX: ${SYNC_RATE_LIMIT_MAX:-120}',
    );
  });

  it('routes /api through NGINX before the SPA fallback and sends security headers', () => {
    const nginxConfig = readFileSync(
      join(repoRoot, 'apps', 'web', 'nginx.conf'),
      'utf8',
    );

    expect(nginxConfig.indexOf('location /api/')).toBeGreaterThan(-1);
    expect(nginxConfig.indexOf('location /api/')).toBeLessThan(
      nginxConfig.indexOf('location / {'),
    );
    expect(nginxConfig).toContain('proxy_pass http://api:3000/api/');
    expect(nginxConfig).toContain('Content-Security-Policy');
    expect(nginxConfig).toContain('connect-src');
    expect(nginxConfig).toContain('https://graphql.anilist.co');
    expect(nginxConfig).toContain('https://archive.org');
    expect(nginxConfig).toContain('https://covers.openlibrary.org');
    expect(nginxConfig).toContain("img-src 'self' data: blob: https:");
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain('X-Content-Type-Options');
    expect(nginxConfig).toContain('Referrer-Policy');
    expect(nginxConfig).toContain('Permissions-Policy');
  });

  it('keeps service-worker runtime caching focused on image-like cover hosts', () => {
    const viteConfig = readFileSync(
      join(repoRoot, 'apps', 'web', 'vite.config.ts'),
      'utf8',
    );

    expect(viteConfig).toContain('wa-external-covers');
    expect(viteConfig).toContain('s4\\\\.anilist\\\\.co');
    expect(viteConfig).not.toContain('(anilist\\\\.co)');
    expect(viteConfig).not.toContain('fonts.googleapis.com');
    expect(viteConfig).not.toContain('cdn.jsdelivr.net');
  });
});
