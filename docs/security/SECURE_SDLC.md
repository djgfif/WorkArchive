# Secure SDLC

## Automated Gates

- `validate / verify`: lint, typecheck, unit tests, API e2e, build, production
  compose config.
- `validate / integration`: PostgreSQL-backed integration tests.
- `CodeQL`: JavaScript/TypeScript CodeQL analysis.
- `release security scan`: Trivy filesystem and image scans on the official
  release CI/runner. The runner must have Trivy installed and cache the Trivy
  vulnerability database between release candidates.
- Dependabot: weekly npm and GitHub Actions update PRs.

Operators must configure GitHub branch protection in GitHub Settings. Repository
settings cannot be guaranteed by files in this repository. Required checks:

- `validate / verify`
- `validate / integration`
- `CodeQL / Analyze JavaScript and TypeScript`
- build as part of `validate / verify`
- release security scan before production or public beta promotion

## npm Audit Policy

Current policy for Gate 1:

- run `npm audit` during dependency review and release preparation;
- block release on critical vulnerabilities in production runtime dependencies;
- review high vulnerabilities case by case, prioritizing reachable server-side
  paths;
- moderate/dev-only findings may be tracked without breaking CI when no fix is
  available or the vulnerable path is not shipped.

This avoids noisy CI failure while the project is still below commercial launch
scale. Revisit once public beta traffic and dependency churn stabilize.

## Trivy Policy

Current policy for release candidates:

- run Trivy on the official release CI/runner, not ordinary local WSL
  development;
- run `npm run security:scan:fs` against the repository checkout;
- run `npm run security:scan:images` with exact API/Web image tags or digests in
  `WORK_ARCHIVE_API_IMAGE` and `WORK_ARCHIVE_WEB_IMAGE`;
- do not use `latest` as a release image scan artifact;
- fail the release gate if Trivy cannot update or read its vulnerability
  database;
- record only runner name, Trivy version, image refs, and summary counts in
  `docs/security/SECURITY_SCAN_RESULTS.md`.

## Secret Scanning Checklist

- Enable GitHub secret scanning and push protection in repository settings.
- For public beta, record branch protection, secret scanning, push protection,
  CodeQL, and Dependabot status in
  `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.
- Do not commit `.env.prod`, provider API keys, Google OAuth secrets, JWT
  secrets, database URLs with real passwords, or backup files.
- Confirm logs and metrics do not contain tokens, cookies, request bodies,
  provider credentials, raw OAuth codes, or raw sync payloads.
- Treat PostgreSQL dumps as sensitive because they include private records,
  account identifiers, encrypted provider credentials, and session metadata.
- Review any new export feature to ensure provider credentials and operational
  server state are excluded.
