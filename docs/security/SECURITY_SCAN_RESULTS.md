# Security Scan Results

Last local update: 2026-05-25.

This file is the release artifact for dependency and container security scans.
Update it for every beta or production release candidate.

Official Trivy runner: release CI/runner with Trivy installed. Do not install
Trivy as part of ordinary local WSL development.

For Gate 1 sequencing, see
[`../commercial/GATE_1_VALIDATION_RUNBOOK.md`](../commercial/GATE_1_VALIDATION_RUNBOOK.md).
Do not record Trivy or npm audit results in this file unless the command ran and
the summary was directly observed.

## Required Commands

Run from the repository root on the official release runner:

```bash
npm run security:audit:prod
npm run security:audit
npm run security:scan:fs
WORK_ARCHIVE_API_IMAGE=<api-release-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<web-release-tag-or-digest> \
npm run security:scan:images
```

`npm run security:scan:release` runs the filesystem and image scans together
with the same image environment variables.

`security:scan:images` rejects empty image refs and the moving `latest` tag.
Prefer immutable digests when available. Configure runner caching with
`TRIVY_CACHE_DIR` or the CI platform cache so the vulnerability database is
reused across release candidates. A Trivy database update failure fails the
release gate.

## Latest Result

- `npm run security:audit:prod`: not completed locally. The sandboxed run could
  not resolve `registry.npmjs.org`; run on the approved release runner because
  npm audit sends dependency graph metadata to the external npm registry.
- `npm run security:audit`: completed after updating the lockfile-only
  remediation for `qs` from `6.15.1` to `6.15.2`
  (`GHSA-q8mj-m7cp-5q26`). Result: 0 vulnerabilities.
- `npm run security:scan:fs`: not run locally by design; run on the official
  release runner where Trivy is installed.
- `npm run security:scan:images`: not run locally by design; run on the official
  release runner with exact API/Web release image refs.

## Result Template

Copy this block for each beta or production release candidate.

```text
Release candidate:
Commit:
Runner:
Timestamp:

npm run security:audit:prod
- status:
- npm version:
- summary:
- action:

npm run security:audit
- status:
- npm version:
- summary:
- action:

npm run security:scan:fs
- status:
- trivy version:
- database timestamp:
- summary:
- action:

WORK_ARCHIVE_API_IMAGE=<api-image-tag-or-digest>
WORK_ARCHIVE_WEB_IMAGE=<web-image-tag-or-digest>
npm run security:scan:images
- status:
- trivy version:
- database timestamp:
- api image:
- web image:
- summary:
- action:

Skipped or failed scans:
- command:
- reason:
- next environment:
- owner:
```

## Recording Rules

- Paste only the command status, timestamp, tool version, and summary counts.
  Do not paste large raw vulnerability reports into this repository.
- If a scan is skipped, record the reason and the environment where it will be
  run next.
- For image scans, record the exact image tag or digest. Do not scan a moving
  `latest` tag as the release artifact.
- If `trivy` is missing locally, record that as a skipped local scan rather than
  installing it ad hoc. The release CI/runner must have Trivy available and must
  fail closed if the vulnerability database cannot be updated.
