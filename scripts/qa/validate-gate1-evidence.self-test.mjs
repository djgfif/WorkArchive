#!/usr/bin/env node
import {
  existsSync,
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

const sourceEvidence = readFileSync(sourceEvidencePath, 'utf8');
const monitoringReportPattern =
  /`tmp\/monitoring-evidence\/monitoring-evidence-\d{8}T\d{6}Z\.md`/;
const monitoringReportMatch = monitoringReportPattern.exec(sourceEvidence);

if (!monitoringReportMatch) {
  failures.push('source evidence must include a backticked monitoring report path.');
} else {
  const reportPath = monitoringReportMatch[0].slice(1, -1);
  if (!existsSync(join(rootDir, reportPath))) {
    failures.push(`source evidence monitoring report does not exist: ${reportPath}`);
  }
}

rmSync(workspaceTempDir, { force: true, recursive: true });
mkdirSync(workspaceTempDir, { recursive: true });

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
  const fixture = sourceEvidence.replace(monitoringReportPattern, replacement);
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
