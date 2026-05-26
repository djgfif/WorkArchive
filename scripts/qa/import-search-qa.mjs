#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const liveMode = process.env.IMPORT_SEARCH_QA_LIVE === 'true';
const reportDir = resolve(
  rootDir,
  process.env.IMPORT_SEARCH_QA_REPORT_DIR ?? 'tmp/import-search-qa',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `import-search-qa-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `import-search-qa-${stamp}.json`);
const accessToken = process.env.IMPORT_QA_ACCESS_TOKEN ?? '';
const fullMatrixLive = process.env.IMPORT_SEARCH_QA_FULL_MATRIX === 'true';
const matrixPath = resolve(rootDir, 'docs/qa/IMPORT_SEARCH_QA_CASES.json');
const matrixDocPath = resolve(rootDir, 'docs/qa/IMPORT_SEARCH_QA_MATRIX.md');

const matrixData = loadMatrix();
const matrix = matrixData.cases;
const liveSmokeCaseIds = new Set(
  matrix.filter((item) => item.liveSmoke).map((item) => item.id),
);
const liveProviderQualityMinimumDistinctTypes = 3;

const sensitiveNames = [
  'ACCESS_TOKEN',
  'API_KEY',
  'COOKIE',
  'OAUTH',
  'PASSWORD',
  'SECRET',
  'TOKEN',
];

function redact(value) {
  let text = String(value ?? '');
  for (const name of sensitiveNames) {
    text = text.replace(new RegExp(`(${name}[A-Z0-9_]*=)[^\\s]+`, 'gi'), '$1[REDACTED]');
  }
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  if (accessToken) {
    text = text.split(accessToken).join('[REDACTED]');
  }
  return text;
}

function relativePath(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : '[outside-workspace]';
}

function normalizeBaseUrl(rawBaseUrl) {
  const url = new URL(rawBaseUrl);
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

function apiPath(baseUrl, path) {
  const url = new URL(baseUrl);
  const prefix = url.pathname.endsWith('/api') ? '' : '/api';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${prefix}${path}`;
  return url;
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
    '',
    '## Checks',
    '',
    '| Check | Status | Summary |',
    '| --- | --- | --- |',
    ...report.checks.map(
      (check) =>
        `| ${check.name} | ${check.status} | ${redact(check.summary).replace(/\|/g, '\\|')} |`,
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
  const tags = new Set(matrix.flatMap((item) => item.tags ?? []));
  const missingMedia = (matrixData.requiredMediaTypes ?? []).filter(
    (mediumType) => !mediumTypes.has(mediumType),
  );
  const missingTags = (matrixData.requiredCoverageTags ?? []).filter(
    (tag) => !tags.has(tag),
  );
  const duplicateIds = matrix
    .map((item) => item.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  if (
    missingMedia.length > 0 ||
    missingTags.length > 0 ||
    duplicateIds.length > 0
  ) {
    return {
      status: 'FAIL',
      summary: `Missing media: ${missingMedia.join(', ') || 'none'}; missing tags: ${missingTags.join(', ') || 'none'}; duplicate IDs: ${duplicateIds.join(', ') || 'none'}.`,
    };
  }

  return {
    status: 'PASS',
    summary: `${matrix.length} cases cover ${[...mediumTypes].join(', ')} and ${tags.size} assertion tags from ${relativePath(matrixPath)}.`,
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

async function liveChecks() {
  const rawBaseUrl = process.env.IMPORT_QA_BASE_URL ?? process.env.VITE_API_BASE_URL;
  const checks = [];
  const liveResults = [];

  if (!rawBaseUrl) {
    checks.push({
      name: 'live import/search base URL',
      status: 'BLOCKED',
      summary: 'IMPORT_SEARCH_QA_LIVE=true but IMPORT_QA_BASE_URL/VITE_API_BASE_URL is not set.',
    });
    return { checks, liveResults };
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  const liveCases = fullMatrixLive
    ? matrix
    : matrix.filter((item) => liveSmokeCaseIds.has(item.id));

  for (const item of liveCases) {
    const url = apiPath(baseUrl, '/imports/search');
    url.searchParams.set('query', item.query);
    url.searchParams.set('mediumType', item.mediumType);
    url.searchParams.set('limit', '5');

    try {
      const startedAt = performance.now();
      const response = await fetch(url, { headers });
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
        .slice(0, 5)
        .some((candidate) => candidate.mediumType === item.mediumType || candidate.type === item.mediumType);
      const hasExpectedProviderCandidate = candidates.slice(0, 5).some((candidate) => {
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
        resultCount: candidates.length,
        fallbackSafetyStatus,
        providerQualityStatus,
        status,
        topCandidates: candidates.slice(0, 5).map((candidate) => {
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
        resultCount: 0,
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
    summary: `${providerQualityTypes.size}/${liveProviderQualityMinimumDistinctTypes} required distinct medium types had non-manual expected-type provider candidates in top 5: ${[...providerQualityTypes].join(', ') || 'none'}.`,
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
