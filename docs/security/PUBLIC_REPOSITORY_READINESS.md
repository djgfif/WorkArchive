# Public Repository Readiness

This checklist is required before changing `djgfif/WorkArchive` from private to
public.

## Current Audit Result

Last local audit: 2026-05-22.

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
- `apps/api/.env` previously existed in git history with local development
  placeholder values. No real provider key was found in the current high
  confidence scan, but rotate any secret that was ever copied into a committed
  file or issue before making the repository public.

## Required Commands

Run from the repository root:

```bash
scripts/security/public-readiness-check.sh
git status --short --branch
```

The readiness script must end with `Public readiness check passed.`

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
  and backup archives are not committed.
- Confirm root development entrypoints are limited to the documented launchers:
  `start-dev.bat`, `stop-dev.bat`, `start-dev.sh`, and `stop-dev.sh`. Optional
  Windows WSL convenience wrappers live under `scripts/windows/`.
- Confirm historical commits do not contain real secrets. If a real secret was
  committed at any point, rotate the secret first; rewrite git history only with
  explicit approval because it requires a force push.

## Visibility Switch

After the checks pass:

1. Open repository settings on GitHub.
2. Change visibility from private to public.
3. Re-run the `validate` workflow on `master`.
4. Confirm the public repository page does not expose private deployment
   details, credentials, local-only screenshots, or machine-specific paths.
