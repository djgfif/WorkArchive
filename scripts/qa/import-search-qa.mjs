#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const liveMode = readBooleanEnv('IMPORT_SEARCH_QA_LIVE', false);
const reportDir = resolve(
  rootDir,
  process.env.IMPORT_SEARCH_QA_REPORT_DIR ?? 'tmp/import-search-qa',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `import-search-qa-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `import-search-qa-${stamp}.json`);
const accessToken = process.env.IMPORT_QA_ACCESS_TOKEN ?? '';
const fullMatrixLive = readBooleanEnv('IMPORT_SEARCH_QA_FULL_MATRIX', false);
const liveProviderFilter = parseProviderFilter(
  process.env.IMPORT_SEARCH_QA_PROVIDERS,
);
const matrixPath = resolve(rootDir, 'docs/qa/IMPORT_SEARCH_QA_CASES.json');
const matrixDocPath = resolve(rootDir, 'docs/qa/IMPORT_SEARCH_QA_MATRIX.md');

const matrixData = loadMatrix();
const matrix = matrixData.cases;
const liveSmokeCaseIds = new Set(
  matrix.filter((item) => item.liveSmoke).map((item) => item.id),
);

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

function readIntegerEnv(name, fallback, { min = 0 } = {}) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }

  const parsed = Number(rawValue);

  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }

  return parsed;
}

const liveProviderQualityMinimumDistinctTypes = readIntegerEnv(
  'IMPORT_SEARCH_QA_MIN_PROVIDER_TYPES',
  3,
);
const liveProviderQualityTopN = readIntegerEnv('IMPORT_SEARCH_QA_TOP_N', 5, {
  min: 1,
});
const liveRequestDelayMs = readIntegerEnv(
  'IMPORT_SEARCH_QA_DELAY_MS',
  fullMatrixLive ? (accessToken ? 1_100 : 3_100) : 0,
);
const liveRateLimitRetries = readIntegerEnv(
  'IMPORT_SEARCH_QA_RATE_LIMIT_RETRIES',
  1,
);

const sensitiveNames = [
  'ACCESS_TOKEN',
  'API_KEY',
  'COOKIE',
  'OAUTH',
  'PASSWORD',
  'SECRET',
  'TOKEN',
];
const sensitiveUrlParamPattern =
  /access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token/i;
const sensitiveInlineValuePattern =
  /\b((?:access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^\s&;,]+/gi;

function parseProviderFilter(rawValue) {
  if (!rawValue) {
    return [];
  }

  return Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function redact(value) {
  let text = String(value ?? '');
  for (const name of sensitiveNames) {
    text = text.replace(new RegExp(`(${name}[A-Z0-9_]*=)[^\\s]+`, 'gi'), '$1[REDACTED]');
  }
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
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

function escapeMarkdownTableCell(value) {
  let escaped = '';

  for (const char of String(value ?? '')) {
    if (char === '|') {
      escaped += '\\|';
    } else if (char === '\r' || char === '\n') {
      escaped += '<br>';
    } else {
      escaped += char;
    }
  }

  return escaped;
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : '[outside-workspace]';
}

function normalizeBaseUrl(rawBaseUrl) {
  const url = new URL(rawBaseUrl);
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

function resolveLiveBaseUrl() {
  const importQaBaseUrl = process.env.IMPORT_QA_BASE_URL?.trim();
  const viteApiBaseUrl = process.env.VITE_API_BASE_URL?.trim();
  const rawBaseUrl = importQaBaseUrl || viteApiBaseUrl || '';

  if (!rawBaseUrl) {
    return {
      baseUrl: null,
      blockedSummary:
        'IMPORT_SEARCH_QA_LIVE=true but IMPORT_QA_BASE_URL is not set.',
    };
  }

  if (!/^https?:\/\//i.test(rawBaseUrl)) {
    return {
      baseUrl: null,
      blockedSummary:
        'IMPORT_SEARCH_QA_LIVE=true requires IMPORT_QA_BASE_URL to be an absolute http(s) beta API/web origin; VITE_API_BASE_URL=/api is only a browser build-time proxy path.',
    };
  }

  try {
    return {
      baseUrl: normalizeBaseUrl(rawBaseUrl),
      blockedSummary: null,
    };
  } catch {
    return {
      baseUrl: null,
      blockedSummary:
        'IMPORT_SEARCH_QA_LIVE=true requires IMPORT_QA_BASE_URL to be a valid absolute http(s) URL.',
    };
  }
}

function apiPath(baseUrl, path) {
  const url = new URL(baseUrl);
  const prefix = url.pathname.endsWith('/api') ? '' : '/api';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${prefix}${path}`;
  return url;
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function parseRetryDelayMs(response) {
  const retryAfter = response.headers.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1_000);
    }

    const retryAtMs = Date.parse(retryAfter);

    if (Number.isFinite(retryAtMs)) {
      return Math.max(0, retryAtMs - Date.now());
    }
  }

  const rateLimitReset = response.headers.get('ratelimit-reset');
  const resetSeconds = rateLimitReset ? Number(rateLimitReset) : NaN;

  if (Number.isFinite(resetSeconds) && resetSeconds >= 0) {
    return Math.ceil(resetSeconds * 1_000);
  }

  return liveRequestDelayMs > 0 ? liveRequestDelayMs : 1_000;
}

async function fetchLiveSearch(url, options) {
  let retryCount = 0;
  let rateLimitWaitMs = 0;
  let response = await fetch(url, options);

  while (response.status === 429 && retryCount < liveRateLimitRetries) {
    const retryDelayMs = parseRetryDelayMs(response);

    rateLimitWaitMs += retryDelayMs;
    retryCount += 1;
    await delay(retryDelayMs);
    response = await fetch(url, options);
  }

  return {
    rateLimitWaitMs,
    response,
    retryCount,
  };
}

function writeReports(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Import/Search QA Report',
    '',
    `- Timestamp UTC: ${report.timestamp}`,
    `- Mode: ${report.mode}`,
    `- Git commit: ${report.gitCommit}`,
    `- Working tree: ${report.workingTree}`,
    `- Overall status: ${report.status}`,
    `- Matrix coverage: ${report.matrixCoverage}`,
    `- Provider filter: ${report.liveProviderFilter.length > 0 ? report.liveProviderFilter.join(', ') : 'none'}`,
    '',
    '## Checks',
    '',
    '| Check | Status | Summary |',
    '| --- | --- | --- |',
    ...report.checks.map(
      (check) =>
        `| ${check.name} | ${check.status} | ${escapeMarkdownTableCell(redact(check.summary))} |`,
    ),
    '',
  ];

  if (report.liveResults.length > 0) {
    lines.push('## Live Query Results', '');
    lines.push(
      `Live mode executed ${report.liveCoverageDescription}. Provider quality PASS requires non-manual candidates for at least ${liveProviderQualityMinimumDistinctTypes} distinct medium types in the smoke subset; manual fallback alone is counted only for fallback safety.`,
    );
    lines.push('');
    for (const result of report.liveResults) {
      lines.push(`### ${result.id}`, '');
      lines.push(`- Query: ${result.query}`);
      lines.push(`- Medium type: ${result.mediumType}`);
      lines.push(`- Status: ${result.status}`);
      lines.push(`- Fallback safety status: ${result.fallbackSafetyStatus}`);
      lines.push(`- Provider quality status: ${result.providerQualityStatus}`);
      lines.push(`- HTTP status: ${result.httpStatus ?? 'not-run'}`);
      lines.push(`- Retries: ${result.retryCount ?? 0}`);
      lines.push(`- Result count: ${result.resultCount}`);
      lines.push(`- Diagnostics: ${result.diagnosticsSummary}`);
      lines.push(`- Top candidates: ${result.topCandidates.join('; ') || 'none'}`);
      lines.push('');
    }
  }

  lines.push('## Matrix Coverage', '');
  for (const item of matrix) {
    lines.push(
      `- ${item.id}: ${item.mediumType}, "${item.query}" -> ${item.expectedAssertion}`,
    );
  }

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

function loadMatrix() {
  const parsed = JSON.parse(readFileSync(matrixPath, 'utf8'));

  if (!Array.isArray(parsed.cases)) {
    throw new Error(`${relativePath(matrixPath)} must define a cases array.`);
  }

  return parsed;
}

function gitValue(args, fallback = 'unknown') {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() : fallback;
}

function offlineChecks() {
  const checks = [];
  const testArgs = [
    'run',
    'test',
    '--workspace',
    '@work-archive/api',
    '--',
    '--runTestsByPath',
    'test/import-search-qa-matrix.spec.ts',
    'test/import-candidate-ranking.ko-fixtures.spec.ts',
    'test/import-search-qa-contract.spec.ts',
    'test/import-candidate-merge.spec.ts',
    'test/imports.service.spec.ts',
  ];
  const testResult = spawnSync('npm', testArgs, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });
  const output = redact(`${testResult.stdout}\n${testResult.stderr}`);

  checks.push({
    name: 'offline import/search Jest fixtures',
    status: testResult.status === 0 ? 'PASS' : 'FAIL',
    summary:
      testResult.status === 0
        ? 'Focused ranking, merge/dedupe, provider diagnostics, and manual fallback tests passed.'
        : output.split(/\r?\n/).filter(Boolean).slice(-10).join(' '),
  });

  checks.push({
    name: 'canonical matrix shape',
    status: validateMatrixShape().status,
    summary: validateMatrixShape().summary,
  });

  checks.push({
    name: 'matrix runbook linkage',
    status: validateMatrixDoc().status,
    summary: validateMatrixDoc().summary,
  });

  return checks;
}

function validateMatrixShape() {
  const mediumTypes = new Set(matrix.map((item) => item.mediumType));
  const providers = new Set(
    matrix.flatMap((item) =>
      [item.expectedCandidate, ...(item.otherCandidates ?? [])].flatMap(
        (candidate) => (candidate ? [candidate.sourceId] : []),
      ),
    ),
  );
  const tags = new Set(matrix.flatMap((item) => item.tags ?? []));
  const missingMedia = (matrixData.requiredMediaTypes ?? []).filter(
    (mediumType) => !mediumTypes.has(mediumType),
  );
  const missingProviders = (matrixData.requiredProviders ?? []).filter(
    (provider) => !providers.has(provider),
  );
  const missingTags = (matrixData.requiredCoverageTags ?? []).filter(
    (tag) => !tags.has(tag),
  );
  const duplicateIds = matrix
    .map((item) => item.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  if (
    missingMedia.length > 0 ||
    missingProviders.length > 0 ||
    missingTags.length > 0 ||
    duplicateIds.length > 0
  ) {
    return {
      status: 'FAIL',
      summary: `Missing media: ${missingMedia.join(', ') || 'none'}; missing providers: ${missingProviders.join(', ') || 'none'}; missing tags: ${missingTags.join(', ') || 'none'}; duplicate IDs: ${duplicateIds.join(', ') || 'none'}.`,
    };
  }

  return {
    status: 'PASS',
    summary: `${matrix.length} cases cover ${[...mediumTypes].join(', ')}, ${providers.size} providers, and ${tags.size} assertion tags from ${relativePath(matrixPath)}.`,
  };
}

function validateMatrixDoc() {
  const doc = readFileSync(matrixDocPath, 'utf8');
  const missingIds = matrix
    .map((item) => item.id)
    .filter((id) => !doc.includes(id));

  if (!doc.includes('IMPORT_SEARCH_QA_CASES.json') || missingIds.length > 0) {
    return {
      status: 'FAIL',
      summary: `Runbook must link ${relativePath(matrixPath)} and mention every case ID. Missing IDs: ${missingIds.join(', ') || 'none'}.`,
    };
  }

  return {
    status: 'PASS',
    summary: `${relativePath(matrixDocPath)} references the canonical matrix and all ${matrix.length} case IDs.`,
  };
}

function getCaseProviderIds(item) {
  return [
    item.expectedCandidate,
    ...(item.otherCandidates ?? []),
  ].flatMap((candidate) => (candidate ? [candidate.sourceId] : []));
}

async function liveChecks() {
  const { baseUrl, blockedSummary } = resolveLiveBaseUrl();
  const checks = [];
  const liveResults = [];

  if (!baseUrl) {
    checks.push({
      name: 'live import/search base URL',
      status: 'BLOCKED',
      summary: blockedSummary,
    });
    return { checks, liveResults };
  }

  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  const liveBaseCases = fullMatrixLive
    ? matrix
    : matrix.filter((item) => liveSmokeCaseIds.has(item.id));
  const liveCases =
    liveProviderFilter.length === 0
      ? liveBaseCases
      : liveBaseCases.filter((item) =>
          getCaseProviderIds(item).some((provider) =>
            liveProviderFilter.includes(provider),
          ),
        );

  if (liveCases.length === 0) {
    checks.push({
      name: 'live import/search provider filter',
      status: 'BLOCKED',
      summary: `IMPORT_SEARCH_QA_PROVIDERS=${liveProviderFilter.join(',')} matched no ${fullMatrixLive ? 'full-matrix' : 'live-smoke'} cases.`,
    });
    return { checks, liveResults };
  }

  for (const [index, item] of liveCases.entries()) {
    const url = apiPath(baseUrl, '/imports/search');
    url.searchParams.set('query', item.query);
    url.searchParams.set('mediumType', item.mediumType);
    url.searchParams.set('limit', String(liveProviderQualityTopN));

    try {
      if (index > 0 && liveRequestDelayMs > 0) {
        await delay(liveRequestDelayMs);
      }

      const startedAt = performance.now();
      const { rateLimitWaitMs, response, retryCount } = await fetchLiveSearch(
        url,
        { headers },
      );
      const durationMs = Math.round(performance.now() - startedAt);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const diagnostics = Array.isArray(data.diagnostics?.providers)
        ? data.diagnostics.providers
        : [];
      const hasManualFallback = candidates.some((candidate) =>
        ['manual', 'preview-manual', 'preview_manual'].includes(candidate.sourceId),
      );
      const hasExpectedType = candidates
        .slice(0, liveProviderQualityTopN)
        .some((candidate) => candidate.mediumType === item.mediumType || candidate.type === item.mediumType);
      const hasExpectedProviderCandidate = candidates.slice(0, liveProviderQualityTopN).some((candidate) => {
        const sourceId = candidate.sourceId ?? '';
        const isManual = ['manual', 'preview-manual', 'preview_manual'].includes(sourceId);
        return (
          !isManual &&
          (candidate.mediumType === item.mediumType || candidate.type === item.mediumType)
        );
      });
      const fallbackSafetyStatus =
        item.id === 'low-confidence-fallback'
          ? response.ok && hasManualFallback
            ? 'PASS'
            : 'FAIL'
          : 'NOT_APPLICABLE';
      const providerQualityStatus =
        item.id === 'low-confidence-fallback'
          ? 'NOT_APPLICABLE'
          : response.ok && hasExpectedProviderCandidate
            ? 'PASS'
            : 'FAIL';
      const status =
        response.ok &&
        (fallbackSafetyStatus !== 'FAIL') &&
        (providerQualityStatus !== 'FAIL' || hasExpectedType || hasManualFallback)
          ? 'PASS'
          : 'FAIL';

      liveResults.push({
        id: item.id,
        diagnosticsSummary: diagnostics
          .map(
            (diagnostic) =>
              `${diagnostic.provider}:${diagnostic.status}:${diagnostic.resultCount ?? 0}:${diagnostic.reasonCode ?? 'ok'}`,
          )
          .join(', '),
        durationMs,
        httpStatus: response.status,
        mediumType: item.mediumType,
        query: item.query,
        rateLimitWaitMs,
        resultCount: candidates.length,
        retryCount,
        fallbackSafetyStatus,
        providerQualityStatus,
        status,
        topCandidates: candidates.slice(0, liveProviderQualityTopN).map((candidate) => {
          const providers = candidate.sourceCoverage?.providers?.join('+') || candidate.sourceId;
          return `${candidate.title} [${candidate.mediumType ?? candidate.type}; ${providers}]`;
        }),
      });
    } catch (error) {
      liveResults.push({
        id: item.id,
        diagnosticsSummary: redact(error instanceof Error ? error.message : String(error)),
        durationMs: null,
        httpStatus: null,
        mediumType: item.mediumType,
        query: item.query,
        rateLimitWaitMs: 0,
        resultCount: 0,
        retryCount: 0,
        fallbackSafetyStatus: item.id === 'low-confidence-fallback' ? 'FAIL' : 'NOT_APPLICABLE',
        providerQualityStatus: item.id === 'low-confidence-fallback' ? 'NOT_APPLICABLE' : 'FAIL',
        status: 'FAIL',
        topCandidates: [],
      });
    }
  }

  const fallbackSafetyPass = liveResults
    .filter((result) => result.fallbackSafetyStatus !== 'NOT_APPLICABLE')
    .every((result) => result.fallbackSafetyStatus === 'PASS');
  const providerQualityTypes = new Set(
    liveResults
      .filter((result) => result.providerQualityStatus === 'PASS')
      .map((result) => result.mediumType),
  );
  const providerQualityPass =
    providerQualityTypes.size >= liveProviderQualityMinimumDistinctTypes;

  checks.push({
    name: 'live import/search fallback safety',
    status: fallbackSafetyPass ? 'PASS' : 'FAIL',
    summary: `${liveResults.filter((result) => result.fallbackSafetyStatus === 'PASS').length}/${liveResults.filter((result) => result.fallbackSafetyStatus !== 'NOT_APPLICABLE').length} fallback-safety smoke cases exposed manual fallback.`,
  });
  checks.push({
    name: 'live import/search provider quality',
    status: providerQualityPass ? 'PASS' : 'FAIL',
    summary: `${providerQualityTypes.size}/${liveProviderQualityMinimumDistinctTypes} required distinct medium types had non-manual expected-type provider candidates in top ${liveProviderQualityTopN}: ${[...providerQualityTypes].join(', ') || 'none'}.`,
  });

  return { checks, liveResults };
}

const report = {
  checks: [],
  gitCommit: gitValue(['rev-parse', 'HEAD']),
  liveResults: [],
  liveCoverageDescription: fullMatrixLive
    ? 'every case in docs/qa/IMPORT_SEARCH_QA_MATRIX.md'
    : 'a smoke subset of docs/qa/IMPORT_SEARCH_QA_MATRIX.md',
  liveProviderFilter,
  matrixCoverage: liveMode
    ? fullMatrixLive
      ? 'full matrix'
      : 'live smoke subset'
    : 'offline static fixtures plus matrix-shape check',
  mode: liveMode ? 'live' : 'offline',
  status: 'PASS',
  timestamp: new Date().toISOString(),
  workingTree: gitValue(['status', '--short']) ? 'dirty' : 'clean',
};

if (liveMode) {
  const live = await liveChecks();
  report.checks.push(...live.checks);
  report.liveResults.push(...live.liveResults);
} else {
  report.checks.push(...offlineChecks());
}

report.status = report.checks.some((check) => check.status === 'FAIL')
  ? 'FAIL'
  : report.checks.some((check) => check.status === 'BLOCKED')
    ? 'BLOCKED'
    : 'PASS';

writeReports(report);
console.log(`Import/search QA report: ${relativePath(reportPath)}`);

if (report.status === 'FAIL') {
  process.exit(1);
}
