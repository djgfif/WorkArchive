#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.USER_DATA_RIGHTS_SMOKE_REPORT_DIR ?? 'tmp/user-data-rights-smoke',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `user-data-rights-smoke-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `user-data-rights-smoke-${stamp}.json`);
const liveMode = readBooleanEnv('USER_DATA_RIGHTS_SMOKE_LIVE', false);
const accessToken = process.env.USER_DATA_RIGHTS_SMOKE_ACCESS_TOKEN ?? '';
const requestTimeoutMs = readIntegerRangeEnv(
  'USER_DATA_RIGHTS_SMOKE_TIMEOUT_MS',
  10000,
  {
    max: 60000,
    min: 1000,
  },
);
const sensitiveUrlParamPattern =
  /access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token/i;
const sensitiveInlineValuePattern =
  /\b((?:access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^\s&;,]+/gi;

function readBooleanEnv(name, fallback) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(`${name} must be true or false when set.`);
  }

  return rawValue === 'true';
}

function readIntegerRangeEnv(name, fallback, { min, max }) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsed = Number(rawValue);

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function resolveLiveBaseUrl() {
  const rawBaseUrl =
    process.env.USER_DATA_RIGHTS_SMOKE_BASE_URL ??
    process.env.BETA_BASE_URL ??
    process.env.VITE_API_BASE_URL ??
    '';

  if (!rawBaseUrl.trim()) {
    return {
      baseUrl: null,
      blockedSummary:
        'USER_DATA_RIGHTS_SMOKE_LIVE=true requires USER_DATA_RIGHTS_SMOKE_BASE_URL or BETA_BASE_URL.',
    };
  }

  if (!/^https?:\/\//i.test(rawBaseUrl)) {
    return {
      baseUrl: null,
      blockedSummary:
        'USER_DATA_RIGHTS_SMOKE_LIVE=true requires an absolute http(s) beta API/web origin; VITE_API_BASE_URL=/api is only a browser build-time proxy path.',
    };
  }

  try {
    const url = new URL(rawBaseUrl);
    url.pathname = url.pathname.replace(/\/$/, '');

    return {
      baseUrl: url,
      blockedSummary: null,
    };
  } catch {
    return {
      baseUrl: null,
      blockedSummary:
        'USER_DATA_RIGHTS_SMOKE_LIVE=true requires a valid absolute http(s) URL.',
    };
  }
}

function apiUrlFor(baseUrl, path) {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, '');
  const prefix = basePath.endsWith('/api') ? '' : '/api';
  url.pathname = `${basePath}${prefix}${path}`;
  return url.toString();
}

function redact(value) {
  let text = String(value ?? '');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)=\S+/gi, '$1=[REDACTED]');
  text = text.replace(sensitiveInlineValuePattern, '$1[REDACTED]');
  if (accessToken) {
    text = text.split(accessToken).join('[REDACTED]');
  }
  return redactUrlSecrets(text);
}

function redactUrlSecrets(value) {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (match) => {
    try {
      const url = new URL(match);

      if (url.username) {
        url.username = 'redacted';
      }

      if (url.password) {
        url.password = 'redacted';
      }

      for (const key of [...url.searchParams.keys()]) {
        if (sensitiveUrlParamPattern.test(key)) {
          url.searchParams.set(key, '[REDACTED]');
        }
      }

      return url.toString();
    } catch {
      return match;
    }
  });
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : '[outside-workspace]';
}

function gitValue(args, fallback = 'unknown') {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() : fallback;
}

function hasSensitiveField(value) {
  return /"(encryptedKey|authTag|iv|tokenHash|previousTokenHash|ipHash|userAgentHash)"\s*:/i.test(
    JSON.stringify(value),
  );
}

function hasHighRiskPayloadField(value) {
  return /"(changes|payload|result|note|reviewNote)"\s*:/i.test(
    JSON.stringify(value),
  );
}

function statusFromBoolean(ok) {
  return ok ? 'PASS' : 'FAIL';
}

function assertHeader(response, headerName, pattern) {
  return pattern.test(response.headers.get(headerName) ?? '');
}

async function requestJson(baseUrl, path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(apiUrlFor(baseUrl, path), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    const bodyText = await response.text();
    let body = null;

    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }

    return {
      body,
      bodyText,
      cacheControlOk: assertHeader(response, 'cache-control', /no-store/i),
      contentTypeOk: assertHeader(response, 'content-type', /application\/json/i),
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDryRunChecks() {
  return [
    {
      detail:
        'Dry-run confirms the smoke contract without calling a beta host. Live mode requires USER_DATA_RIGHTS_SMOKE_LIVE=true, an absolute base URL, and a disposable authenticated access token.',
      name: 'live prerequisites',
      status: 'PASS',
    },
    {
      detail:
        'Live mode will call GET /api/auth/data-export and verify status, JSON shape, no-store caching, absence of known secret field names, and absence of high-risk JSON payload fields.',
      name: 'data export contract',
      status: 'PASS',
    },
    {
      detail:
        'Live mode will call GET /api/auth/account/deletion-preview and verify count-only shape, no-store caching, and absence of row payload or secret field names.',
      name: 'deletion preview contract',
      status: 'PASS',
    },
    {
      detail:
        'The smoke intentionally never calls DELETE /api/auth/account; destructive deletion rehearsal remains a separate manual/disposable-target run.',
      name: 'destructive deletion guard',
      status: 'PASS',
    },
  ];
}

async function buildLiveChecks() {
  const { baseUrl, blockedSummary } = resolveLiveBaseUrl();

  if (!baseUrl || !accessToken) {
    return [
      {
        detail:
          blockedSummary ??
          'USER_DATA_RIGHTS_SMOKE_LIVE=true requires USER_DATA_RIGHTS_SMOKE_ACCESS_TOKEN.',
        name: 'live prerequisites',
        status: 'BLOCKED',
      },
    ];
  }

  const checks = [
    {
      detail: `Using beta origin ${redact(baseUrl.toString())}.`,
      name: 'live prerequisites',
      status: 'PASS',
    },
  ];

  try {
    const exportResponse = await requestJson(baseUrl, '/auth/data-export');
    const exportShapeOk =
      exportResponse.status === 200 &&
      typeof exportResponse.body?.exportedAt === 'string' &&
      typeof exportResponse.body?.counts === 'object' &&
      Array.isArray(exportResponse.body?.omittedSensitiveFields);
    const exportSecretOk = !hasSensitiveField(exportResponse.body);
    const exportPayloadOk = !hasHighRiskPayloadField(exportResponse.body);

    checks.push({
      detail: [
        `HTTP ${exportResponse.status}`,
        `json=${exportShapeOk}`,
        `cacheControlNoStore=${exportResponse.cacheControlOk}`,
        `contentTypeJson=${exportResponse.contentTypeOk}`,
        `secretFieldNamesAbsent=${exportSecretOk}`,
        `highRiskPayloadFieldsAbsent=${exportPayloadOk}`,
      ].join(', '),
      name: 'data export contract',
      status: statusFromBoolean(
        exportShapeOk &&
          exportSecretOk &&
          exportPayloadOk &&
          exportResponse.cacheControlOk &&
          exportResponse.contentTypeOk,
      ),
    });
  } catch (error) {
    checks.push({
      detail: redact(error instanceof Error ? error.message : String(error)),
      name: 'data export contract',
      status: 'FAIL',
    });
  }

  try {
    const previewResponse = await requestJson(
      baseUrl,
      '/auth/account/deletion-preview',
    );
    const previewShapeOk =
      previewResponse.status === 200 &&
      typeof previewResponse.body?.generatedAt === 'string' &&
      typeof previewResponse.body?.cascadeDeletedRecords === 'object' &&
      typeof previewResponse.body?.anonymizedRecords === 'object' &&
      Array.isArray(previewResponse.body?.omittedSensitiveFields);
    const previewSecretOk =
      !hasSensitiveField(previewResponse.body) &&
      !hasHighRiskPayloadField(previewResponse.body);

    checks.push({
      detail: [
        `HTTP ${previewResponse.status}`,
        `json=${previewShapeOk}`,
        `cacheControlNoStore=${previewResponse.cacheControlOk}`,
        `contentTypeJson=${previewResponse.contentTypeOk}`,
        `rowPayloadAbsent=${previewSecretOk}`,
      ].join(', '),
      name: 'deletion preview contract',
      status: statusFromBoolean(
        previewShapeOk &&
          previewSecretOk &&
          previewResponse.cacheControlOk &&
          previewResponse.contentTypeOk,
      ),
    });
  } catch (error) {
    checks.push({
      detail: redact(error instanceof Error ? error.message : String(error)),
      name: 'deletion preview contract',
      status: 'FAIL',
    });
  }

  checks.push({
    detail:
      'DELETE /api/auth/account was not called. Use the documented deletion rehearsal only against a disposable target.',
    name: 'destructive deletion guard',
    status: 'PASS',
  });

  return checks;
}

function deriveStatus(checks) {
  if (checks.some((check) => check.status === 'FAIL')) {
    return 'FAIL';
  }

  if (checks.some((check) => check.status === 'BLOCKED')) {
    return 'BLOCKED';
  }

  return 'PASS';
}

function renderMarkdown(report) {
  const lines = [
    '# User Data Rights Smoke',
    '',
    `- Timestamp UTC: ${report.timestamp}`,
    `- Git commit: ${report.gitCommit}`,
    `- Working tree: ${report.workingTree}`,
    `- Mode: ${report.mode}`,
    `- Status: ${report.status}`,
    `- Report JSON: ${relativePath(jsonReportPath)}`,
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
  ];

  for (const check of report.checks) {
    lines.push(
      `| ${check.name} | ${check.status} | ${redact(check.detail).replace(/\|/g, '\\|')} |`,
    );
  }

  lines.push(
    '',
    'This smoke does not call `DELETE /api/auth/account`. Destructive account deletion evidence must use a disposable account and the deletion rehearsal checklist.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

const checks = liveMode ? await buildLiveChecks() : buildDryRunChecks();
const report = {
  checks,
  gitCommit: gitValue(['rev-parse', 'HEAD']),
  mode: liveMode ? 'live' : 'dry-run',
  status: deriveStatus(checks),
  timestamp: new Date().toISOString(),
  workingTree: gitValue(['status', '--short']) ? 'dirty' : 'clean',
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(reportPath, renderMarkdown(report), 'utf8');

console.log(`User data rights smoke report: ${relativePath(reportPath)}`);

if (report.status === 'FAIL') {
  process.exit(1);
}
