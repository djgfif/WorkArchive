# Security Scan Results

Last local run: 2026-05-25 20:24:39 KST.

This file is the release artifact for dependency and container security scans.
Update it for every beta or production release candidate.

Official Trivy runner: release CI/runner with Trivy installed. Do not install
Trivy as part of ordinary local WSL development.

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
  not resolve `registry.npmjs.org`; the escalated run was blocked because npm
  audit sends dependency graph metadata to the external npm registry.
- `npm run security:audit`: completed and returned 1 moderate vulnerability:
  `qs@6.15.1` via `@nestjs/platform-express -> express -> body-parser/qs`
  (`GHSA-q8mj-m7cp-5q26`). `npm audit fix` is the suggested remediation, but no
  dependency update was applied in this hardening pass.
- `npm run security:scan:fs`: not run locally by design; run on the official
  release runner where Trivy is installed.
- `npm run security:scan:images`: not run locally by design; run on the official
  release runner with exact API/Web release image refs.

## Recording Rules

- Paste only the command status, timestamp, tool version, and summary counts.
  Do not paste large raw vulnerability reports into this repository.
- If a scan is skipped, record the reason and the environment where it will be
  run next.
- For image scans, record the exact image tag or digest. Do not scan a moving
  `latest` tag as the release artifact.
