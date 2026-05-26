# Gate 1 Validation Runbook

Last updated: 2026-05-26

Gate 1 evidence must be copied from commands that actually ran. Leave an item
`not run`, `blocked`, or `manual` when the required environment is unavailable.

## Execution Order

1. Start from a clean release-candidate commit.
2. Run local repository gates:

   ```bash
   npm run qa:gate1:local
   ```

3. Run focused import/search QA:

   ```bash
   npm run qa:import-search
   ```

4. Run sync load payload validation in dry-run mode:

   ```bash
   npm run qa:sync-load
   ```

5. On the release runner, run dependency/container security scans.
6. On the beta host, run production env preflight and beta smoke.
7. With GitHub Settings access, verify branch protection, required checks,
   CodeQL, Dependabot, secret scanning, and push protection.
8. With backup/restore access, perform the restore drill into a non-production
   target.
9. With a disposable authenticated test account, run live import/search QA and
   live sync load validation.
10. Copy only summary results into
    `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

## Local Checks

The local helper records command, exit code, timestamp, git commit, dirty status,
and a redacted output summary:

```bash
npm run qa:gate1:local
```

It runs local/repository-verifiable checks such as `npm ci`,
`npm run security:public`, docs links, lint, typecheck, tests, e2e, build,
script syntax checks, and Docker compose config only when Docker and `.env.prod`
are available. It does not run beta host, GitHub Settings, restore drill, Trivy
image, or live provider checks.

Generated reports are written to `docs/commercial/evidence/` unless
`GATE1_EVIDENCE_DIR` is set.

## Release Runner Checks

Run these on the approved release runner with network access and Trivy
installed:

```bash
npm run security:audit:prod
npm run security:audit
npm run security:scan:fs
WORK_ARCHIVE_API_IMAGE=<immutable-api-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<immutable-web-tag-or-digest> \
npm run security:scan:images
```

Record only tool versions, timestamps, image refs, status, and summary counts in
`docs/security/SECURITY_SCAN_RESULTS.md`. Do not paste raw vulnerability reports
or scan payloads.

## Beta Host Checks

Run with real beta-host `.env.prod` values:

```bash
scripts/deploy/beta-preflight.sh
BETA_BASE_URL=<beta-url> scripts/deploy/beta-smoke.sh
```

The public unauthenticated `/metrics` result must remain `404`. If metrics are
enabled for an internal collector, verify the bearer-token path only from the
reviewed internal network path and never commit the token.

## GitHub Settings Checks

Verify and record:

- Branch protection for `master`.
- Required checks.
- Latest CodeQL result for the release commit.
- Dependabot enabled.
- Secret scanning enabled.
- Push protection enabled.
- Any explicit waivers and approver.

These cannot be proven from local repository files alone.

## Provider/Search QA

Offline/static mode is CI-safe and does not call external providers:

```bash
npm run qa:import-search
```

Live mode requires an explicit beta/staging URL and should use a disposable test
account token when authenticated provider coverage is required:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_QA_ACCESS_TOKEN=<disposable-test-account-token> \
npm run qa:import-search
```

The golden matrix is in `docs/qa/IMPORT_SEARCH_QA_MATRIX.md`. Live provider
results are observations for that run, not permanent truth.

## Sync Load Validation

Dry-run mode validates synthetic payload generation without API calls:

```bash
npm run qa:sync-load
```

Live mode requires a disposable authenticated test account:

```bash
SYNC_LOAD_DRY_RUN=false \
SYNC_LOAD_BASE_URL=https://beta.example.com \
SYNC_LOAD_ACCESS_TOKEN=<disposable-test-account-token> \
SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true \
SYNC_LOAD_RECORDS=1000 \
SYNC_LOAD_BATCH_SIZE=200 \
SYNC_LOAD_PULL_LIMIT=500 \
npm run qa:sync-load
```

The script creates only synthetic records with titles prefixed
`Gate1 Sync Load QA`. Do not run it against a real user account.

## Backup And Restore Drill

Create a PostgreSQL backup, copy it off-host, restore once into a
non-production target, then smoke `/readyz` and authenticated sync. Record
observed RPO/RTO and gaps. Do not commit database dumps, backup contents, or raw
user data.

## What Must Not Be Committed

- Secrets, access tokens, OAuth codes, cookies, provider keys, or `.env.prod`.
- Database dumps, backup contents, or raw sync payloads with personal data.
- Raw provider responses with user/provider data.
- Full audit or Trivy raw reports when they contain unnecessary dependency
  metadata; commit only summaries when appropriate.

## Filling The Evidence Ledger

Keep `PUBLIC_BETA_GATE_1_EVIDENCE.md` as the human operator ledger. Copy only
observed command summaries from generated reports and operational runs. Do not
change `Status: no public beta evidence recorded yet` until a real public beta
release-candidate evidence run is complete.
