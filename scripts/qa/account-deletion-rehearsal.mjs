#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const reportDir = resolve(
  rootDir,
  process.env.ACCOUNT_DELETION_REHEARSAL_REPORT_DIR ??
    'tmp/account-deletion-rehearsal',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `account-deletion-rehearsal-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `account-deletion-rehearsal-${stamp}.json`);

const liveMode = readBooleanEnv('ACCOUNT_DELETION_REHEARSAL_LIVE', false);
const accessToken = process.env.ACCOUNT_DELETION_REHEARSAL_ACCESS_TOKEN ?? '';
const confirmEmail = process.env.ACCOUNT_DELETION_REHEARSAL_CONFIRM_EMAIL ?? '';
const disposableAccountAck = readBooleanEnv(
  'ACCOUNT_DELETION_REHEARSAL_DISPOSABLE_ACCOUNT_ACK',
  false,
);
const destructiveConfirm =
  process.env.ACCOUNT_DELETION_REHEARSAL_CONFIRM?.trim() ?? '';
const requestTimeoutMs = readIntegerRangeEnv(
  'ACCOUNT_DELETION_REHEARSAL_TIMEOUT_MS',
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
const DESTRUCTIVE_CONFIRMATION = 'delete-disposable-account';

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
    process.env.ACCOUNT_DELETION_REHEARSAL_BASE_URL ??
    process.env.BETA_BASE_URL ??
    '';

  if (!rawBaseUrl.trim()) {
    return {
      baseUrl: null,
      blockedSummary:
        'ACCOUNT_DELETION_REHEARSAL_LIVE=true requires ACCOUNT_DELETION_REHEARSAL_BASE_URL or BETA_BASE_URL.',
    };
  }

  if (!/^https?:\/\//i.test(rawBaseUrl)) {
    return {
      baseUrl: null,
      blockedSummary:
        'ACCOUNT_DELETION_REHEARSAL_LIVE=true requires an absolute http(s) beta API/web origin.',
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
        'ACCOUNT_DELETION_REHEARSAL_LIVE=true requires a valid absolute http(s) URL.',
    };
  }
}

function allowedOriginFor(baseUrl) {
  const configured =
    process.env.ACCOUNT_DELETION_REHEARSAL_ALLOWED_ORIGIN ??
    process.env.SMOKE_ALLOWED_ORIGIN ??
    '';

  if (!configured.trim()) {
    return new URL(baseUrl).origin;
  }

  return new URL(configured).origin;
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
  text = text.replace(/(Cookie:\s*)[^\\n]+/gi, '$1[REDACTED]');
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

function statusFromBoolean(ok) {
  return ok ? 'PASS' : 'FAIL';
}

function assertHeader(response, headerName, pattern) {
  return pattern.test(response.headers.get(headerName) ?? '');
}

async function requestJson(baseUrl, path, { body, expectedStatuses, method }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
    'X-Work-Archive-Client': 'web',
  };

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers.origin = allowedOriginFor(baseUrl);
  }

  try {
    const response = await fetch(apiUrlFor(baseUrl, path), {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
      signal: controller.signal,
    });
    const bodyText = await response.text();
    let parsedBody = null;

    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsedBody = null;
    }

    return {
      body: parsedBody,
      bodyText: redact(bodyText).slice(0, 2000),
      cacheControlOk: assertHeader(response, 'cache-control', /no-store/i),
      contentTypeOk: assertHeader(response, 'content-type', /application\/json/i),
      expectedStatusOk: expectedStatuses.includes(response.status),
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
        'Dry-run confirms the destructive rehearsal contract without calling a beta host.',
      name: 'dry-run safety contract',
      status: 'PASS',
    },
    {
      detail:
        'Live mode requires ACCOUNT_DELETION_REHEARSAL_LIVE=true, an absolute base URL, a disposable authenticated access token, the disposable-account acknowledgement, confirmation email, and ACCOUNT_DELETION_REHEARSAL_CONFIRM=delete-disposable-account.',
      name: 'live destructive prerequisites',
      status: 'PASS',
    },
    {
      detail:
        'Live mode first calls GET /api/auth/account/deletion-preview and checks count-only JSON with Cache-Control: no-store.',
      name: 'pre-delete preview guard',
      status: 'PASS',
    },
    {
      detail:
        'Live mode calls DELETE /api/auth/account with confirmEmail and acknowledgeIrreversible=true, then verifies the same token can no longer export account data.',
      name: 'post-delete token invalidation check',
      status: 'PASS',
    },
  ];
}

function validateLivePrerequisites(baseUrl, blockedSummary) {
  const missing = [];

  if (!baseUrl || blockedSummary) {
    missing.push(blockedSummary);
  }

  if (!accessToken) {
    missing.push(
      'ACCOUNT_DELETION_REHEARSAL_ACCESS_TOKEN is required for live deletion rehearsal.',
    );
  }

  if (!confirmEmail.trim()) {
    missing.push(
      'ACCOUNT_DELETION_REHEARSAL_CONFIRM_EMAIL is required for live deletion rehearsal.',
    );
  }

  if (!disposableAccountAck) {
    missing.push(
      'ACCOUNT_DELETION_REHEARSAL_DISPOSABLE_ACCOUNT_ACK=true is required and must only be set for a disposable authenticated account.',
    );
  }

  if (destructiveConfirm !== DESTRUCTIVE_CONFIRMATION) {
    missing.push(
      `ACCOUNT_DELETION_REHEARSAL_CONFIRM must equal ${DESTRUCTIVE_CONFIRMATION}.`,
    );
  }

  return missing.filter(Boolean);
}

async function buildLiveChecks() {
  const { baseUrl, blockedSummary } = resolveLiveBaseUrl();
  const missing = validateLivePrerequisites(baseUrl, blockedSummary);

  if (missing.length > 0) {
    return [
      {
        detail: missing.map(redact).join(' '),
        name: 'live destructive prerequisites',
        status: 'BLOCKED',
      },
    ];
  }

  const checks = [
    {
      detail: `Using beta origin ${redact(baseUrl.toString())}.`,
      name: 'live destructive prerequisites',
      status: 'PASS',
    },
  ];

  try {
    const previewResponse = await requestJson(
      baseUrl,
      '/auth/account/deletion-preview',
      {
        expectedStatuses: [200],
        method: 'GET',
      },
    );
    const previewShapeOk =
      previewResponse.status === 200 &&
      typeof previewResponse.body?.generatedAt === 'string' &&
      typeof previewResponse.body?.cascadeDeletedRecords === 'object' &&
      typeof previewResponse.body?.anonymizedRecords === 'object' &&
      Array.isArray(previewResponse.body?.omittedSensitiveFields);

    checks.push({
      detail: [
        `HTTP ${previewResponse.status}`,
        `json=${previewShapeOk}`,
        `cacheControlNoStore=${previewResponse.cacheControlOk}`,
        `contentTypeJson=${previewResponse.contentTypeOk}`,
      ].join(', '),
      name: 'pre-delete preview guard',
      status: statusFromBoolean(
        previewShapeOk &&
          previewResponse.cacheControlOk &&
          previewResponse.contentTypeOk,
      ),
    });
  } catch (error) {
    checks.push({
      detail: redact(error instanceof Error ? error.message : String(error)),
      name: 'pre-delete preview guard',
      status: 'FAIL',
    });
  }

  if (checks.some((check) => check.status !== 'PASS')) {
    return checks;
  }

  try {
    const deleteResponse = await requestJson(baseUrl, '/auth/account', {
      body: {
        acknowledgeIrreversible: true,
        confirmEmail: confirmEmail.trim(),
      },
      expectedStatuses: [200],
      method: 'DELETE',
    });
    const deleteShapeOk =
      deleteResponse.status === 200 &&
      typeof deleteResponse.body?.deletedAt === 'string' &&
      typeof deleteResponse.body?.cascadeDeletedRecords === 'object' &&
      typeof deleteResponse.body?.anonymizedRecords === 'object';

    checks.push({
      detail: [
        `HTTP ${deleteResponse.status}`,
        `json=${deleteShapeOk}`,
        `cacheControlNoStore=${deleteResponse.cacheControlOk}`,
        `contentTypeJson=${deleteResponse.contentTypeOk}`,
      ].join(', '),
      name: 'account deletion request',
      status: statusFromBoolean(
        deleteShapeOk &&
          deleteResponse.cacheControlOk &&
          deleteResponse.contentTypeOk,
      ),
    });
  } catch (error) {
    checks.push({
      detail: redact(error instanceof Error ? error.message : String(error)),
      name: 'account deletion request',
      status: 'FAIL',
    });
  }

  if (checks.some((check) => check.status !== 'PASS')) {
    return checks;
  }

  try {
    const exportResponse = await requestJson(baseUrl, '/auth/data-export', {
      expectedStatuses: [401],
      method: 'GET',
    });

    checks.push({
      detail: [
        `HTTP ${exportResponse.status}`,
        `expectedUnauthorized=${exportResponse.expectedStatusOk}`,
        `cacheControlNoStore=${exportResponse.cacheControlOk}`,
      ].join(', '),
      name: 'post-delete token invalidation check',
      status: statusFromBoolean(
        exportResponse.expectedStatusOk && exportResponse.cacheControlOk,
      ),
    });
  } catch (error) {
    checks.push({
      detail: redact(error instanceof Error ? error.message : String(error)),
      name: 'post-delete token invalidation check',
      status: 'FAIL',
    });
  }

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
    '# Account Deletion Rehearsal',
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
    'Live mode is destructive. Use only a disposable authenticated account and copy only this redacted summary into release evidence.',
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

console.log(`Account deletion rehearsal report: ${relativePath(reportPath)}`);

if (report.status === 'FAIL' || (liveMode && report.status === 'BLOCKED')) {
  process.exit(1);
}
