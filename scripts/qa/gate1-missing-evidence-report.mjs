#!/usr/bin/env node
import { runGate1EvidenceValidation } from './validate-gate1-evidence.mjs';

const evidencePath =
  process.argv.find(
    (argument) => !argument.startsWith('--') && argument.endsWith('.md'),
  ) ?? 'docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md';

const result = runGate1EvidenceValidation({
  evidencePath,
  strictMode: false,
});

const categories = [
  {
    key: 'release',
    title: 'Release Metadata And Approval',
    classification: 'C',
    nextAction:
      'Assign the beta URL, release notes/ticket, approval decision, approver, and blocker disposition in the evidence ledger.',
    patterns: [
      /top-level Status/i,
      /Public beta URL/i,
      /Release notes or ticket/i,
      /Public beta approved/i,
      /Approver/i,
      /follow-up blockers/i,
    ],
  },
  {
    key: 'github',
    title: 'GitHub Controls',
    classification: 'C',
    nextAction:
      'Verify branch protection, required checks, CodeQL, Dependabot, secret scanning, and push protection in GitHub Settings for the release commit.',
    patterns: [
      /Branch protection/i,
      /Required checks/i,
      /CodeQL/i,
      /Dependabot/i,
      /Secret scanning/i,
      /Push protection/i,
      /Vulnerability waivers/i,
    ],
  },
  {
    key: 'monitoring',
    title: 'Monitoring, Alerts, And SLO Evidence',
    classification: 'C',
    nextAction:
      'Deploy alert/SLO/dashboard artifacts, confirm /metrics exposure boundaries, and run live monitoring evidence collection.',
    patterns: [
      /qa:monitoring/i,
      /Alert rule/i,
      /SLO rule/i,
      /Grafana/i,
      /Prometheus/i,
      /Alertmanager/i,
      /SLO 30d/i,
      /Public unauthenticated `\/metrics`/i,
      /Internal collector `\/metrics`/i,
      /`\/metrics` internal collector bearer-token result/i,
    ],
  },
  {
    key: 'backup',
    title: 'Backup And Restore Drill',
    classification: 'C',
    nextAction:
      'Create, verify, copy off-host, and restore a production-sized backup into a disposable non-production target.',
    patterns: [
      /Backup command/i,
      /Backup report/i,
      /Backup file identifier/i,
      /Backup checksum/i,
      /Backup verification/i,
      /Backup off-host/i,
      /Restore drill/i,
      /Restore target/i,
      /Restore start\/end/i,
      /Observed RPO/i,
      /Observed RTO/i,
      /Post-restore/i,
    ],
  },
  {
    key: 'host',
    title: 'Beta Host Preflight And Smoke',
    classification: 'C',
    nextAction:
      'Run commercial beta rehearsal or beta preflight plus beta smoke against the beta host with real .env.prod values.',
    patterns: [
      /docker compose .*\.env\.prod config/i,
      /beta-preflight/i,
      /Migration command/i,
      /API\/web startup/i,
      /beta-smoke/i,
      /\/health/i,
      /\/livez/i,
      /\/readyz/i,
      /Auth refresh/i,
      /Google OAuth/i,
      /No-store/i,
      /Provider readiness/i,
      /Guest JSON/i,
      /Guest-to-account/i,
      /Authenticated sync/i,
      /Sync conflict/i,
      /Import provider failure/i,
      /User data rights smoke/i,
      /metrics.*exposure result/i,
    ],
  },
  {
    key: 'docker-runtime',
    title: 'Docker Runtime Release-Runner Evidence',
    classification: 'C',
    nextAction:
      'Run npm run qa:docker-runtime:self-test, then DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime on a Docker-enabled release runner with .env.prod and copy the redacted PASS report summary.',
    patterns: [
      /qa:docker-runtime/i,
      /DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime/i,
      /Docker runtime/i,
      /production image build/i,
    ],
  },
  {
    key: 'live-import-search',
    title: 'Live Import/Search QA',
    classification: 'C',
    nextAction:
      'Run IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search against the beta host with disposable authenticated credentials and copy the redacted live PASS report summary.',
    patterns: [
      /IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search/i,
      /live import\/search/i,
      /Import search success/i,
      /Import provider failure/i,
    ],
  },
  {
    key: 'live-sync-load',
    title: 'Live Sync Load QA',
    classification: 'C',
    nextAction:
      'Run SYNC_LOAD_DRY_RUN=false npm run qa:sync-load against the beta host with a disposable authenticated account and copy the redacted live PASS report summary.',
    patterns: [
      /SYNC_LOAD_DRY_RUN=false npm run qa:sync-load/i,
      /Live sync load/i,
      /Sync load/i,
      /sync timing/i,
      /Authenticated sync/i,
    ],
  },
  {
    key: 'performance',
    title: 'Smoke Performance Baseline',
    classification: 'C',
    nextAction:
      'Run live performance smoke against the beta host and copy p50/p95, status, and rate-limit header summaries.',
    patterns: [
      /Performance smoke/i,
      /performance baseline/i,
      /Authenticated disposable account/i,
      /not measured/i,
    ],
  },
  {
    key: 'repository',
    title: 'Repository Or Release-Runner Gates',
    classification: 'A/C',
    nextAction:
      'Run the listed repository or release-runner command and copy only the redacted summary result.',
    patterns: [
      /repository gate/i,
      /security:audit/i,
      /test:e2e/i,
      /npm run build/i,
    ],
  },
];

const grouped = new Map(categories.map((category) => [category.key, []]));
const other = [];

for (const finding of result.findings) {
  const normalized = finding.replace(`${result.evidenceFile}: `, '');
  const category = categories.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalized)),
  );

  if (!category) {
    other.push(normalized);
    continue;
  }

  grouped.get(category.key)?.push(normalized);
}

console.log('# Gate 1 Missing Evidence Report');
console.log();
console.log(`- Evidence ledger: ${evidencePath}`);
console.log(`- Missing or incomplete items: ${result.findings.length}`);
console.log(`- Warning items: ${result.warnings.length}`);
console.log(
  '- Classification key: A = code/script can resolve locally; B = runbook/evidence template needs documentation; C = external beta host, GitHub Settings, release runner, restore target, or disposable account required.',
);
console.log(
  '- Approval note: this report does not approve a release candidate.',
);
console.log();

for (const category of categories) {
  const findings = grouped.get(category.key) ?? [];
  if (findings.length === 0) {
    continue;
  }

  console.log(`## ${category.title}`);
  console.log();
  console.log(`- Count: ${findings.length}`);
  console.log(`- Classification: ${category.classification}`);
  console.log(`- Next action: ${category.nextAction}`);
  console.log('- Ledger checks:');
  for (const finding of findings) {
    console.log(`  - ${finding}`);
  }
  console.log();
}

if (other.length > 0) {
  console.log('## Other Evidence Checks');
  console.log();
  console.log(`- Count: ${other.length}`);
  console.log('- Ledger checks:');
  for (const finding of other) {
    console.log(`  - ${finding}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log('## Warnings');
  console.log();
  for (const warning of result.warnings) {
    console.log(`- ${warning.replace(`${result.evidenceFile}: `, '')}`);
  }
  console.log();
}

if (result.findings.length === 0) {
  console.log('Gate 1 evidence has no missing items.');
}
