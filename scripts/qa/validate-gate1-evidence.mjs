#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const MAX_REFERENCED_REPORT_BYTES = 1024 * 1024;
let evidenceFile = resolve(
  rootDir,
  'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md',
);
let strict = false;
let text = '';
let findings = [];
let warnings = [];

const requiredSections = [
  'Release Candidate',
  'Repository Gates',
  'GitHub Controls',
  'Host Preflight And Smoke',
  'Metrics And Alerts',
  'Backup And Restore Drill',
  'Smoke-Level Performance Baseline',
  'Decision',
];

const requiredPassCommands = [
  'npm run security:public',
  'npm run check:docs-links',
  'npm run lint',
  'npm run typecheck',
  'npm run test',
  'npm run build',
  'npm run qa:migrations',
  'npm run qa:bola-matrix',
  'npm run qa:api-auth-surface',
  'npm run qa:api-input-contracts',
  'npm run qa:api-cache-policy',
  'npm run qa:api-security-headers',
  'npm run qa:api-error-policy',
  'npm run qa:csrf-policy',
  'npm run qa:deploy-scripts',
  'npm run qa:docker-runtime:self-test',
  'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime',
  'npm run qa:owner-invariants',
  'npm run qa:compose-hardening',
  'npm run qa:auth-session-policy',
  'npm run qa:oauth-policy',
  'npm run qa:log-redaction-policy',
  'npm run qa:operator-safety',
  'npm run qa:backup-restore-policy',
  'npm run qa:secure-sdlc-policy',
  'npm run qa:public-boundary',
  'npm run qa:retention-policy',
  'npm run qa:user-data-rights-policy',
  'npm run qa:account-deletion-rehearsal',
  'npm run qa:commercial:repo',
  'npm run qa:import-search',
  'IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search',
  'npm run qa:sync-load',
  'SYNC_LOAD_DRY_RUN=false npm run qa:sync-load',
  'npm run qa:alerts',
  'npm run qa:slo',
  'npm run qa:dashboards',
  'npm run test:e2e:web',
  'npm run test:e2e',
  'docker compose -f compose.prod.yml --env-file .env.prod config',
];

const requiredNonEmptyFields = [
  'Public beta URL',
  'Release notes or ticket',
  'Branch protection enabled for `master`',
  'Required checks',
  'CodeQL result',
  'Dependabot enabled',
  'Production npm audit high/critical gate',
  'Secret scanning enabled',
  'Push protection enabled',
  'Vulnerability waivers',
  'scripts/deploy/beta-preflight.sh',
  'Migration command',
  'API/web startup',
  'scripts/deploy/beta-smoke.sh',
  '/health',
  '/livez',
  '/readyz',
  '`/metrics` public unauthenticated exposure result',
  '`/metrics` internal collector bearer-token result',
  'Google OAuth login/logout',
  'Guest JSON export/import',
  'Guest-to-account transfer review',
  'Authenticated sync push/pull',
  'Sync conflict resolution',
  'Import provider failure fallback',
  '`npm run qa:monitoring` report',
  'Alert rule file deployed',
  'SLO rule file deployed',
  'Grafana dashboard file deployed',
  'Grafana dashboard UID',
  'Prometheus/collector target for `/metrics`',
  'Alertmanager or notification channel',
  'API availability SLO 30d',
  'API latency p95 SLO 30d',
  'Auth refresh success SLO 30d',
  'Sync success SLO 30d',
  'Import search success SLO 30d',
  'Public unauthenticated `/metrics` result',
  'Internal collector `/metrics` result',
  'Backup command (`npm run ops:backup`)',
  'Backup report (`tmp/backups/prod-backup-*.md` summary only)',
  'Backup file identifier',
  'Backup checksum sidecar (`.sha256`)',
  'Backup verification command (`npm run ops:backup:verify`)',
  'Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only)',
  'Backup off-host copy location',
  'Restore drill command (`npm run ops:restore-drill` with `RESTORE_DRILL_CONFIRM=restore-disposable-target`)',
  'Restore target (must be disposable/non-production)',
  'Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only)',
  'Restore start/end time',
  'Observed RPO',
  'Observed RTO',
  'Post-restore `/readyz`',
  'Post-restore sync smoke',
  'Performance smoke command',
  'Performance smoke report',
  'Authenticated disposable account used for sync timing',
  'Public beta approved',
  'Approver',
];

const placeholderPatterns = [
  /\bnot run\b/i,
  /\bnot verified\b/i,
  /\bnot measured\b/i,
  /\bnot available\b/i,
  /\bnot yet assigned\b/i,
  /\bpending\b/i,
  /\bblocked\b/i,
  /\bmanual\b/i,
  /\brequires?\b/i,
  /\bdry-run\b/i,
  /\bdry run\b/i,
  /\blocal development\b/i,
  /\bbeta host required\b/i,
  /\brequires beta host\b/i,
];

const secretSafetyPatterns = [
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i],
  ['basic credential', /\bBasic\s+[A-Za-z0-9._~+/=-]{12,}/i],
  [
    'secret-like environment value',
    /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|COOKIE)[A-Z0-9_]*=(?!\[REDACTED\]\b)[^\s`]+/i,
  ],
  [
    'sensitive key-value fragment',
    /\b(?:access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=(?!\[REDACTED\]\b)[^\s&;,`]+/i,
  ],
  [
    'database or Redis URL with credentials',
    /\b(?:postgres(?:ql)?|rediss?):\/\/[^@\s`]+@/i,
  ],
  ['HTTP URL userinfo', /\bhttps?:\/\/[^/\s:@`]+:[^@\s`]*@/i],
];

function addFinding(message) {
  findings.push(`${evidenceFile}: ${message}`);
}

function addWarning(message) {
  warnings.push(`${evidenceFile}: ${message}`);
}

function readBooleanEnv(name, fallback) {
  const value = process.env[name]?.trim();

  if (!value) {
    return fallback;
  }

  if (value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be true or false when set.`);
  }

  return value === 'true';
}

function extractSection(title) {
  const pattern = new RegExp(
    `^## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=^## |$)`,
    'm',
  );
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBulletValue(label) {
  const escapedLabel = escapeRegex(label);
  const pattern = new RegExp(`^- ${escapedLabel}:[ \t]*(.*)$`, 'm');
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}

function isBlank(value) {
  return value === null || value === '';
}

function hasPlaceholder(value) {
  return placeholderPatterns.some((pattern) => pattern.test(value));
}

function commandLine(command) {
  const escaped = escapeRegex(command);
  const pattern = new RegExp('^- `' + escaped + '`:[ \t]*(.*)$', 'm');
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}

function resolveWorkspacePath(path) {
  if (!path.startsWith('tmp/') || path.includes('..')) {
    return null;
  }

  const resolved = resolve(rootDir, path);
  if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${sep}`)) {
    return null;
  }

  return resolved;
}

function markdownReportPaths(value) {
  return Array.from(value.matchAll(/`(tmp\/[^`]+\.md)`/g), (match) => match[1]);
}

function findSecretSafetyIssues(content) {
  return secretSafetyPatterns.flatMap(([description, pattern]) =>
    pattern.test(content) ? [description] : [],
  );
}

function validateSections() {
  for (const section of requiredSections) {
    if (extractSection(section) === null) {
      addFinding(`missing required section "${section}".`);
    }
  }
}

function validateStatus() {
  const statusMatch = /^Status:\s*(.*)$/m.exec(text);
  const status = statusMatch?.[1]?.trim() ?? '';
  if (!status) {
    addFinding('missing top-level Status line.');
    return;
  }
  if (/partial|pending|blocked|not run|incomplete/i.test(status)) {
    addFinding(`top-level Status is not release-ready: "${status}".`);
  }
}

function validateRepositoryGates() {
  for (const command of requiredPassCommands) {
    const value = commandLine(command);
    if (isBlank(value)) {
      addFinding(`missing repository gate result for ${command}.`);
      continue;
    }
    if (!/^PASS\b/.test(value)) {
      addFinding(`repository gate ${command} is not PASS: "${value}".`);
    }
  }
}

function validateReferencedLocalReports() {
  const reportEvidence = [
    ['npm run qa:import-search', commandLine('npm run qa:import-search')],
    [
      'IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search',
      commandLine('IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search'),
    ],
    ['npm run qa:sync-load', commandLine('npm run qa:sync-load')],
    [
      'SYNC_LOAD_DRY_RUN=false npm run qa:sync-load',
      commandLine('SYNC_LOAD_DRY_RUN=false npm run qa:sync-load'),
    ],
    [
      'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime',
      commandLine('DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime'),
    ],
    [
      '`npm run qa:monitoring` report',
      findBulletValue('`npm run qa:monitoring` report'),
    ],
    ['Performance smoke report', findBulletValue('Performance smoke report')],
    [
      'Backup report (`tmp/backups/prod-backup-*.md` summary only)',
      findBulletValue('Backup report (`tmp/backups/prod-backup-*.md` summary only)'),
    ],
    [
      'Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only)',
      findBulletValue(
        'Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only)',
      ),
    ],
    [
      'Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only)',
      findBulletValue(
        'Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only)',
      ),
    ],
  ];

  for (const [label, value] of reportEvidence) {
    if (isBlank(value)) {
      continue;
    }

    const paths = markdownReportPaths(value);
    if (hasPlaceholder(value) && paths.length === 0) {
      continue;
    }

    if (paths.length === 0) {
      addFinding(`required evidence field "${label}" must include a backticked tmp/*.md report path.`);
      continue;
    }

    for (const path of paths) {
      const resolved = resolveWorkspacePath(path);
      if (!resolved) {
        addFinding(`required evidence field "${label}" references an unsafe or non-workspace report path: "${path}".`);
        continue;
      }

      if (!existsSync(resolved)) {
        addFinding(`required evidence field "${label}" references missing report ${path}.`);
        continue;
      }

      const linkStat = lstatSync(resolved);
      if (linkStat.isSymbolicLink()) {
        addFinding(`required evidence field "${label}" references symbolic link report ${path}.`);
        continue;
      }

      const stat = statSync(resolved);
      if (!stat.isFile()) {
        addFinding(`required evidence field "${label}" references non-file report ${path}.`);
        continue;
      }

      if (stat.size === 0) {
        addFinding(`required evidence field "${label}" references empty report ${path}.`);
        continue;
      }

      if (stat.size > MAX_REFERENCED_REPORT_BYTES) {
        addFinding(
          `required evidence field "${label}" references oversized report ${path} (${stat.size} bytes; max ${MAX_REFERENCED_REPORT_BYTES}).`,
        );
        continue;
      }

      const reportText = readFileSync(resolved, 'utf8');
      for (const issue of findSecretSafetyIssues(reportText)) {
        addFinding(`required evidence field "${label}" references report ${path} that appears to contain a ${issue}.`);
      }
      validateReportContent(label, path, reportText);
    }
  }
}

function validateReportContent(label, path, reportText) {
  const reportExpectations = {
    'DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime': {
      forbidden: [],
      required: [
        ['overall PASS status', /- Overall status:\s*PASS\b/],
        ['config-and-build mode', /- Mode:\s*config-and-build\b/],
        [
          'production image build PASS check',
          /\|\s*production image build\s*\|\s*PASS\s*\|/,
        ],
      ],
    },
    'IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search': {
      forbidden: [
        ['offline mode marker', /- Mode:\s*offline\b/i],
        ['blocked live check marker', /\|\s*live import\/search [^|]+\|\s*BLOCKED\s*\|/i],
      ],
      required: [
        ['live mode', /- Mode:\s*live\b/],
        ['overall PASS status', /- Overall status:\s*PASS\b/],
        [
          'live fallback safety PASS check',
          /\|\s*live import\/search fallback safety\s*\|\s*PASS\s*\|/i,
        ],
        [
          'live provider quality PASS check',
          /\|\s*live import\/search provider quality\s*\|\s*PASS\s*\|/i,
        ],
      ],
    },
    'SYNC_LOAD_DRY_RUN=false npm run qa:sync-load': {
      forbidden: [
        ['dry-run mode marker', /- Mode:\s*dry-run\b/i],
        ['blocked status marker', /- Status:\s*BLOCKED\b/i],
        ['failure status marker', /- Status:\s*FAIL\b/i],
      ],
      required: [
        ['live mode', /- Mode:\s*live\b/],
        ['PASS status', /- Status:\s*PASS\b/],
        ['1000 synthetic records', /- Synthetic records:\s*1000\b/],
        ['batch size 200', /- Batch size:\s*200\b/],
        ['pull limit 500', /- Pull limit:\s*500\b/],
        ['zero failures', /- Failures:\s*0\b/],
        ['zero conflicts', /- Conflicts:\s*0\b/],
        ['oversized push batch DTO rejection', /- Oversized push batch smoke HTTP status:\s*400\b/],
      ],
    },
    '`npm run qa:monitoring` report': {
      forbidden: [
        ['dry-run status marker', /- Status:\s*DRY_RUN\b/i],
        ['dry-run mode marker', /- Mode:\s*dry-run\b/i],
      ],
      required: [
        ['live mode', /- Mode:\s*live\b/],
        ['PASS status', /- Status:\s*PASS\b/],
      ],
    },
    'Performance smoke report': {
      forbidden: [
        ['dry-run scenario marker', /\|\s*[^|]+\|\s*DRY-RUN\s*\|/i],
        ['blocked scenario marker', /\|\s*[^|]+\|\s*BLOCKED\s*\|/i],
        ['dry-run mode marker', /- Mode:\s*dry-run\b/i],
      ],
      required: [
        ['live mode', /- Mode:\s*live\b/],
        ['PASS status', /- Status:\s*PASS\b/],
      ],
    },
  };

  const expectation = reportExpectations[label];
  if (!expectation) {
    return;
  }

  for (const [description, pattern] of expectation.required) {
    if (!pattern.test(reportText)) {
      addFinding(
        `required evidence field "${label}" references report ${path} without ${description}.`,
      );
    }
  }

  for (const [description, pattern] of expectation.forbidden) {
    if (pattern.test(reportText)) {
      addFinding(
        `required evidence field "${label}" references report ${path} with ${description}.`,
      );
    }
  }
}

function validateFields() {
  for (const label of requiredNonEmptyFields) {
    const value = findBulletValue(label);
    if (isBlank(value)) {
      addFinding(`required evidence field "${label}" is blank or missing.`);
      continue;
    }
    if (hasPlaceholder(value)) {
      addFinding(`required evidence field "${label}" still looks incomplete: "${value}".`);
    }
  }
}

function validateMetricsExposure() {
  const publicMetrics = findBulletValue('Public unauthenticated `/metrics` result');
  if (publicMetrics && !/\b404\b/.test(publicMetrics)) {
    addFinding('public unauthenticated /metrics result must explicitly include 404.');
  }

  const internalMetrics = findBulletValue('Internal collector `/metrics` result');
  if (internalMetrics && !/\b200\b/.test(internalMetrics)) {
    addFinding('internal collector /metrics result must explicitly include 200.');
  }
}

function validatePerformanceTable() {
  const section = extractSection('Smoke-Level Performance Baseline');
  if (!section) {
    return;
  }

  const rows = section
    .split(/\r?\n/)
    .filter((line) => /^\| `/.test(line));
  if (rows.length === 0) {
    addFinding('performance baseline table has no measured scenario rows.');
    return;
  }

  for (const row of rows) {
    if (hasPlaceholder(row)) {
      addFinding(`performance baseline row is incomplete: "${row}".`);
    }
  }
}

function validateDecision() {
  const approved = findBulletValue('Public beta approved');
  if (approved && !/\b(yes|approved|true)\b/i.test(approved)) {
    addFinding(`public beta approval is not affirmative: "${approved}".`);
  }
}

function validateSecretSafety() {
  for (const issue of findSecretSafetyIssues(text)) {
    addFinding(`evidence ledger appears to contain a ${issue}.`);
  }
}

function validateNotes() {
  const followUpBlockers = findBulletValue('Follow-up blockers');
  if (followUpBlockers && !/none|n\/a|no\b/i.test(followUpBlockers)) {
    addWarning(`follow-up blockers are recorded: "${followUpBlockers}".`);
  }
}

export function runGate1EvidenceValidation({
  evidencePath = 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md',
  strictMode = readBooleanEnv('GATE1_EVIDENCE_STRICT', false),
} = {}) {
  evidenceFile = resolve(rootDir, evidencePath);
  strict = strictMode;
  text = readFileSync(evidenceFile, 'utf8');
  findings = [];
  warnings = [];

  validateSections();
  validateStatus();
  validateRepositoryGates();
  validateReferencedLocalReports();
  validateFields();
  validateMetricsExposure();
  validatePerformanceTable();
  validateDecision();
  validateSecretSafety();
  validateNotes();

  return {
    evidenceFile,
    findings: [...findings],
    strict,
    warnings: [...warnings],
  };
}

function printValidationResult(result) {
  for (const warning of result.warnings) {
    console.warn(warning);
  }

  if (result.findings.length > 0) {
    const summary = `Gate 1 evidence is incomplete: ${result.findings.length} required item(s) need attention.`;
    if (result.strict) {
      console.error([summary, ...result.findings].join('\n'));
      return 1;
    }

    console.log(summary);
    console.log('Run with GATE1_EVIDENCE_STRICT=true or --strict to fail public beta approval on these findings.');
    for (const finding of result.findings.slice(0, 40)) {
      console.log(`- ${finding}`);
    }
    if (result.findings.length > 40) {
      console.log(`- [${result.findings.length - 40} additional finding(s) omitted]`);
    }
    return 0;
  }

  console.log('Gate 1 evidence completeness validation passed.');
  return 0;
}

const entrypointUrl =
  process.argv[1] === undefined
    ? null
    : pathToFileURL(process.argv[1]).href;

if (entrypointUrl === import.meta.url) {
  const result = runGate1EvidenceValidation({
    evidencePath: process.argv[2] ?? 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md',
    strictMode:
      readBooleanEnv('GATE1_EVIDENCE_STRICT', false) ||
      process.argv.includes('--strict'),
  });

  process.exit(printValidationResult(result));
}
