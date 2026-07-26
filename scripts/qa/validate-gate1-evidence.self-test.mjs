#!/usr/bin/env node
import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { runGate1EvidenceValidation } from './validate-gate1-evidence.mjs';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const sourceEvidencePath = join(
  rootDir,
  'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md',
);
const workspaceTempDir = join(rootDir, 'tmp/gate1-evidence-validator-self-test');
const failures = [];

const sourceEvidenceTemplate = readFileSync(sourceEvidencePath, 'utf8');
const monitoringReportPattern =
  /`tmp\/monitoring-evidence\/monitoring-evidence-\d{8}T\d{6}Z\.md`/;
const monitoringReportMatch = monitoringReportPattern.exec(sourceEvidenceTemplate);

if (!monitoringReportMatch) {
  failures.push('source evidence must include a backticked monitoring report path.');
}

rmSync(workspaceTempDir, { force: true, recursive: true });
mkdirSync(workspaceTempDir, { recursive: true });

const baselineMonitoringReportPath =
  'tmp/gate1-evidence-validator-self-test/monitoring-baseline.md';
writeFileSync(
  join(rootDir, baselineMonitoringReportPath),
  ['# Monitoring Evidence Report', '', '- Mode: dry-run', '- Status: DRY_RUN', ''].join('\n'),
);
const sourceEvidence = sourceEvidenceTemplate.replace(
  monitoringReportPattern,
  `\`${baselineMonitoringReportPath}\``,
);

try {
  if (failures.length === 0) {
    runMalformedStrictEnvFixture();

    runFixture({
      expectedMessage: 'references missing report tmp/monitoring-evidence/missing-report.md',
      name: 'missing report',
      replacement: '`tmp/monitoring-evidence/missing-report.md`',
    });

    const emptyReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/empty-report.md',
    );
    writeFileSync(emptyReportPath, '');
    runFixture({
      expectedMessage:
        'references empty report tmp/gate1-evidence-validator-self-test/empty-report.md',
      name: 'empty report',
      replacement: '`tmp/gate1-evidence-validator-self-test/empty-report.md`',
    });

    const symlinkTargetPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/symlink-target.md',
    );
    const symlinkReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/symlink-report.md',
    );
    writeFileSync(symlinkTargetPath, '# Symlink target\n');
    symlinkSync(symlinkTargetPath, symlinkReportPath);
    runFixture({
      expectedMessage:
        'references symbolic link report tmp/gate1-evidence-validator-self-test/symlink-report.md',
      name: 'symlink report',
      replacement: '`tmp/gate1-evidence-validator-self-test/symlink-report.md`',
    });

    const oversizedReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/oversized-report.md',
    );
    writeFileSync(oversizedReportPath, `${'x'.repeat(1024 * 1024 + 1)}\n`);
    runFixture({
      expectedMessage:
        'references oversized report tmp/gate1-evidence-validator-self-test/oversized-report.md',
      name: 'oversized report',
      replacement: '`tmp/gate1-evidence-validator-self-test/oversized-report.md`',
    });

    const secretReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/secret-report.md',
    );
    writeFileSync(
      secretReportPath,
      [
        '# Secret report',
        '',
        'api Bearer raw-access-token-secret',
        'callback=https://operator:raw-password@workarchive.test/callback?code=raw-code&state=raw-state',
        'DATABASE_URL=postgresql://operator:raw-db-password@postgres:5432/work_archive',
        '',
      ].join('\n'),
    );
    runFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/secret-report.md that appears to contain a bearer token',
      name: 'secret report',
      replacement: '`tmp/gate1-evidence-validator-self-test/secret-report.md`',
    });

    runFixture({
      expectedMessage:
        'references an unsafe or non-workspace report path: "tmp/../outside-report.md"',
      name: 'unsafe report path',
      replacement: '`tmp/../outside-report.md`',
    });

    const blockedDockerReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/docker-runtime-blocked.md',
    );
    writeFileSync(
      blockedDockerReportPath,
      [
        '# Docker Runtime Preflight Report',
        '',
        '- Mode: config-only',
        '- Overall status: BLOCKED',
        '',
        '| Check | Status | Command | Summary |',
        '| --- | --- | --- | --- |',
        '| docker CLI version | BLOCKED | `docker --version` | unavailable |',
        '',
      ].join('\n'),
    );
    runDockerReportFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/docker-runtime-blocked.md without overall PASS status',
      name: 'blocked docker runtime report',
      reportPath: 'tmp/gate1-evidence-validator-self-test/docker-runtime-blocked.md',
    });

    const offlineImportSearchReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/import-search-offline.md',
    );
    writeFileSync(
      offlineImportSearchReportPath,
      [
        '# Import/Search QA Report',
        '',
        '- Mode: offline',
        '- Overall status: PASS',
        '',
      ].join('\n'),
    );
    runReportContentFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/import-search-offline.md without live mode',
      label: 'IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search',
      name: 'offline import search report',
      reportPath: 'tmp/gate1-evidence-validator-self-test/import-search-offline.md',
    });

    const dryRunSyncLoadReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/sync-load-dry-run.md',
    );
    writeFileSync(
      dryRunSyncLoadReportPath,
      [
        '# Sync Load Smoke Report',
        '',
        '- Mode: dry-run',
        '- Status: PASS',
        '- Synthetic records: 1000',
        '- Batch size: 200',
        '- Pull limit: 500',
        '',
        '## Result',
        '',
        '- Conflicts: 0',
        '- Failures: 0',
        '',
      ].join('\n'),
    );
    runReportContentFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/sync-load-dry-run.md without live mode',
      label: 'SYNC_LOAD_DRY_RUN=false npm run qa:sync-load',
      name: 'dry-run sync load report',
      reportPath: 'tmp/gate1-evidence-validator-self-test/sync-load-dry-run.md',
    });

    const dryRunMonitoringReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/monitoring-dry-run.md',
    );
    writeFileSync(
      dryRunMonitoringReportPath,
      [
        '# Monitoring Evidence Report',
        '',
        '- Mode: dry-run',
        '- Status: DRY_RUN',
        '',
      ].join('\n'),
    );
    runReportContentFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/monitoring-dry-run.md without live mode',
      label: '`npm run qa:monitoring` report',
      name: 'dry-run monitoring report',
      reportPath: 'tmp/gate1-evidence-validator-self-test/monitoring-dry-run.md',
    });

    const dryRunPerformanceReportPath = join(
      rootDir,
      'tmp/gate1-evidence-validator-self-test/performance-dry-run.md',
    );
    writeFileSync(
      dryRunPerformanceReportPath,
      [
        '# Performance Smoke Baseline',
        '',
        '- Mode: dry-run',
        '- Status: PASS',
        '',
        '| Scenario | Status | Count | p50 ms | p95 ms |',
        '| --- | --- | ---: | ---: | ---: |',
        '| GET /readyz | DRY-RUN | 0 | n/a | n/a |',
        '',
      ].join('\n'),
    );
    runReportContentFixture({
      expectedMessage:
        'references report tmp/gate1-evidence-validator-self-test/performance-dry-run.md without live mode',
      label: 'Performance smoke report',
      name: 'dry-run performance report',
      reportPath: 'tmp/gate1-evidence-validator-self-test/performance-dry-run.md',
    });
  }
} finally {
  rmSync(workspaceTempDir, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error('Gate 1 evidence validator self-test failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Gate 1 evidence validator self-test passed.');

function runFixture({ expectedMessage, name, replacement }) {
  const fixturePath = join(workspaceTempDir, `fixture-${slugify(name)}.md`);
  const fixture = sourceEvidence.replace(
    `\`${baselineMonitoringReportPath}\``,
    replacement,
  );
  if (fixture === sourceEvidence) {
    failures.push(`${name}: fixture replacement did not modify the evidence.`);
    return;
  }

  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, fixture);

  const result = runGate1EvidenceValidation({
    evidencePath: fixturePath,
    strictMode: true,
  });

  if (result.findings.length === 0) {
    failures.push(`${name}: strict validation unexpectedly passed.`);
    return;
  }

  const output = result.findings.join('\n');
  if (!output.includes(expectedMessage)) {
    failures.push(`${name}: expected output to include "${expectedMessage}".`);
  }
}

function runDockerReportFixture({ expectedMessage, name, reportPath }) {
  runReportContentFixture({
    expectedMessage,
    label: 'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime',
    name,
    reportPath,
  });
}

function runReportContentFixture({ expectedMessage, label, name, reportPath }) {
  const fixturePath = join(workspaceTempDir, `fixture-${slugify(name)}.md`);
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelPattern = label.startsWith('`')
    ? escapedLabel
    : `(?:${escapedLabel}|\`${escapedLabel}\`)`;
  const sourceLinePattern = new RegExp(`^- ${labelPattern}:[^\\n]*$`, 'm');
  const shouldRenderAsCommand =
    label.startsWith('`') || label.includes('npm run') || label.includes('=true');
  const renderedLabel = label.startsWith('`')
    ? label
    : shouldRenderAsCommand
      ? `\`${label}\``
      : label;
  const fixture = sourceEvidence.replace(
    sourceLinePattern,
    `- ${renderedLabel}: PASS — report \`${reportPath}\``,
  );

  if (fixture === sourceEvidence) {
    failures.push(`${name}: fixture replacement did not modify the evidence.`);
    return;
  }

  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, fixture);

  const result = runGate1EvidenceValidation({
    evidencePath: fixturePath,
    strictMode: true,
  });

  const output = result.findings.join('\n');
  if (!output.includes(expectedMessage)) {
    failures.push(`${name}: expected output to include "${expectedMessage}".`);
  }
}

function runMalformedStrictEnvFixture() {
  const previousStrict = process.env.GATE1_EVIDENCE_STRICT;

  process.env.GATE1_EVIDENCE_STRICT = 'treu';

  try {
    runGate1EvidenceValidation({
      evidencePath: sourceEvidencePath,
    });
    failures.push('malformed strict env: validation unexpectedly passed.');
    return;
  } catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    if (!output.includes('GATE1_EVIDENCE_STRICT must be true or false when set.')) {
      failures.push(
        'malformed strict env: expected output to include strict boolean validation error.',
      );
    }
  } finally {
    if (previousStrict === undefined) {
      delete process.env.GATE1_EVIDENCE_STRICT;
    } else {
      process.env.GATE1_EVIDENCE_STRICT = previousStrict;
    }
  }
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}
