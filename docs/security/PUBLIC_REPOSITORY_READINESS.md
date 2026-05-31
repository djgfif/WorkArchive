# Public Repository Readiness

This checklist is required before changing `djgfif/WorkArchive` from private to
public.

## Current Audit Result

Last local audit: 2026-05-25.

- The current tree should not track local `.env` files. Commit only
  `.env*.example` templates such as `.env.example`, `.env.compose.example`,
  `.env.host.example`, `.env.prod.example`, `apps/api/.env.example`, and
  `apps/web/.env.example`.
- Local secret-bearing files such as `.env`, `.env.prod`, `apps/api/.env`, and
  `apps/web/.env` must stay ignored and uncommitted.
- Personal tool and IDE state such as `.codex`, `.agents/`, and `.idea/` must
  stay ignored and uncommitted.
- High-confidence token patterns such as GitHub tokens, Google API keys, OpenAI
  style keys, AWS access keys, Slack tokens, and private key PEM blocks should
  return no hits in tracked files.
- The repository root must stay limited to public-facing project files. Runtime
  wrappers live under `scripts/dev/`; Windows convenience wrappers live under
  `scripts/windows/`.
- The active documentation tree must stay limited to `getting-started`,
  `architecture`, `operations`, `security`, `project`, and `management`.
  Historical material belongs under `docs/archive/`.
- Files already tracked by git must not match `.gitignore`; this catches
  accidentally tracked local state after ignore rules are tightened.
- Large binary/media files require explicit review before publication. Design
  source assets should be archived intentionally, not left in the active docs
  path by accident.
- `apps/api/.env` previously existed in git history with local development
  placeholder values. No real provider key was found in the current high
  confidence scan, but rotate any secret that was ever copied into a committed
  file or issue before making the repository public.

## Required Commands

Run from the repository root:

```bash
scripts/security/public-readiness-check.sh
git ls-files -ci --exclude-standard
npm audit --omit=dev
npm audit
trivy fs .
WORK_ARCHIVE_API_IMAGE=<api-release-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<web-release-tag-or-digest> \
npm run security:scan:images
npm run check:docs-links
git status --short --branch
```

The readiness script must end with `Public readiness check passed.`
`trivy` commands run on the official release CI/runner, not ordinary local WSL
development. Document skipped scans in release notes when the runner, Trivy
database update, or release images are unavailable.

Equivalent npm helpers are available for local release checks:

```bash
npm run security:audit:prod
npm run security:audit
npm run security:scan:fs
WORK_ARCHIVE_API_IMAGE=<api-release-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<web-release-tag-or-digest> \
npm run security:scan:images
```

## CSP Notes

`apps/web/nginx.conf` currently keeps a conservative CSP for scripts and object
embedding, but two directives are intentionally broad for the current React and
media model:

- `style-src 'self' 'unsafe-inline'`: Mantine and runtime component styles still
  rely on inline style attributes and injected style blocks. Removing
  `'unsafe-inline'` now would break production UI rendering. Risk: an HTML
  injection bug would have more styling latitude. Future hardening should test
  nonce/hash-based style handling or a build-time extraction path before
  removing it.
- `style-src https://cdn.jsdelivr.net https://fonts.googleapis.com` and
  `font-src https://cdn.jsdelivr.net https://fonts.gstatic.com`: the production
  HTML currently loads Pretendard from jsDelivr and display/mono fonts from
  Google Fonts. Future hardening should self-host these assets before removing
  the third-party font hosts from CSP.
- `img-src 'self' data: https:`: imported catalog covers and user-entered image
  URLs are loaded from multiple HTTPS provider domains, and placeholders may use
  `data:`. Known provider hosts already route through `/api/image-proxy` in the
  web client, including HTTP cover URLs that would otherwise violate production
  CSP. Risk: broad HTTPS image loading can still leak page views to arbitrary
  image hosts supplied by records. Future hardening should measure image proxy
  coverage first, then narrow `img-src` toward `'self' data:` plus any explicitly
  retained provider exceptions.

Do not tighten these directives in a release without browser coverage for the
works list, add flow, detail page, and imported cover rendering.

## Manual Checks

- Confirm GitHub repository secrets and environment secrets do not contain
  values duplicated in committed files.
- Confirm `.env.prod` exists only on the deployment host or local machine, not
  in git.
- Confirm Google OAuth client secret, provider API keys, JWT secrets, external
  API key encryption secret, and security event hash secret are unique per
  environment.
- Confirm production OAuth redirect URIs point to the intended public domain.
- Confirm screenshots, browser traces, Playwright reports, logs, database dumps,
  large unreviewed media files, and backup archives are not committed.
- Confirm the root does not contain development launcher wrappers or ad hoc
  execution notes. Official local entrypoints are `npm run dev:start`,
  `npm run dev:start:host`, and `npm run dev:stop`.
- Confirm local Markdown links resolve after any file move.
- Confirm historical commits do not contain real secrets. If a real secret was
  committed at any point, rotate the secret first; rewrite git history only with
  explicit approval because it requires a force push.

## Root Allowlist

Tracked files at repository root are limited to public project metadata,
package/lock files, compose files, env examples, and standard config files:

- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`
- `package.json`, `package-lock.json`
- `compose.yml`, `compose.prod.yml`
- `.env*.example`
- `.gitignore`, `.dockerignore`, `.gitattributes`, `.nvmrc`, Prettier config,
  Playwright config, and Orval config

Anything else needs an explicit repository policy update before it is tracked.

## Visibility Switch

After the checks pass:

1. Open repository settings on GitHub.
2. Change visibility from private to public.
3. Re-run the `validate` workflow on `master`.
4. Confirm the public repository page does not expose private deployment
   details, credentials, local-only screenshots, or machine-specific paths.
