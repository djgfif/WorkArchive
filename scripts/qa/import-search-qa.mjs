#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const liveMode = process.env.IMPORT_SEARCH_QA_LIVE === 'true';
const reportDir = resolve(
  rootDir,
  process.env.IMPORT_SEARCH_QA_REPORT_DIR ?? 'docs/commercial/evidence',
);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const reportPath = resolve(reportDir, `import-search-qa-${stamp}.md`);
const jsonReportPath = resolve(reportDir, `import-search-qa-${stamp}.json`);
const accessToken = process.env.IMPORT_QA_ACCESS_TOKEN ?? '';

const matrix = [
  {
    id: 'novel-ko-title',
    query: '채식주의자 한강',
    mediumType: 'novel',
    expect: 'novel candidate in top results; author signal improves confidence',
  },
  {
    id: 'light-novel-alias',
    query: 'Sword Art Online 카와하라 레키',
    mediumType: 'light_novel',
    expect: 'light novel exact or alias match outranks weak anime/manga token matches',
  },
  {
    id: 'manga-original-title',
    query: '進撃の巨人',
    mediumType: 'manga',
    expect: 'manga candidate can expose Japanese/original title aliases',
  },
  {
    id: 'webtoon-ko-title',
    query: '유미의 세포들',
    mediumType: 'webtoon',
    expect: 'webtoon candidate appears; book/movie candidates stay below stronger type matches',
  },
  {
    id: 'anime-ambiguous-title',
    query: '너의 이름은',
    mediumType: 'anime',
    expect: 'anime candidate appears in top N with provider/source coverage when available',
  },
  {
    id: 'movie-wrong-medium-guard',
    query: 'Dune 2021',
    mediumType: 'movie',
    expect: 'movie candidate ranks above novel candidates for the same title/year query',
  },
  {
    id: 'drama-spacing-variant',
    query: '이상한 변호사 우 영우',
    mediumType: 'drama',
    expect: 'spacing variant still produces a drama candidate or manual fallback',
  },
  {
    id: 'low-confidence-fallback',
    query: 'Gate1 Search QA Unlikely Synthetic Title',
    mediumType: 'novel',
    expect: 'manual fallback remains available when provider quality is low or providers fail',
  },
];

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
    for (const result of report.liveResults) {
      lines.push(`### ${result.id}`, '');
      lines.push(`- Query: ${result.query}`);
      lines.push(`- Medium type: ${result.mediumType}`);
      lines.push(`- Status: ${result.status}`);
      lines.push(`- HTTP status: ${result.httpStatus ?? 'not-run'}`);
      lines.push(`- Result count: ${result.resultCount}`);
      lines.push(`- Diagnostics: ${result.diagnosticsSummary}`);
      lines.push(`- Top candidates: ${result.topCandidates.join('; ') || 'none'}`);
      lines.push('');
    }
  }

  lines.push('## Matrix Coverage', '');
  for (const item of matrix) {
    lines.push(`- ${item.id}: ${item.mediumType}, "${item.query}" -> ${item.expect}`);
  }

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
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
    'test/import-candidate-ranking.ko-fixtures.spec.ts',
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
    name: 'golden matrix shape',
    status:
      new Set(matrix.map((item) => item.mediumType)).size >= 7 ? 'PASS' : 'FAIL',
    summary: `${matrix.length} cases cover ${[
      ...new Set(matrix.map((item) => item.mediumType)),
    ].join(', ')}.`,
  });

  return checks;
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

  for (const item of matrix) {
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
      const status = response.ok && (hasExpectedType || hasManualFallback) ? 'PASS' : 'FAIL';

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
        status: 'FAIL',
        topCandidates: [],
      });
    }
  }

  checks.push({
    name: 'live import/search API shape',
    status: liveResults.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
    summary: `${liveResults.filter((result) => result.status === 'PASS').length}/${liveResults.length} live matrix cases met broad type-or-manual-fallback assertions.`,
  });

  return { checks, liveResults };
}

const report = {
  checks: [],
  gitCommit: gitValue(['rev-parse', 'HEAD']),
  liveResults: [],
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
console.log(`Import/search QA report: ${reportPath}`);

if (report.status === 'FAIL') {
  process.exit(1);
}
