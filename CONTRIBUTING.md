# Contributing

This repository is public for review, but it is not currently licensed for
general reuse. Coordinate with the maintainer before opening large changes.

## Local Checks

Run the smallest relevant check while developing and the full validation set
before opening a pull request:

```bash
scripts/security/public-readiness-check.sh
npm run lint
npm run typecheck
npm run test --workspaces --if-present
npm run build
```

## Pull Request Expectations

- Keep behavior changes separate from structure-only changes.
- Do not commit real `.env` files, logs, traces, local databases, screenshots
  containing private data, or generated archives.
- Update docs when moving files, changing commands, or changing security
  expectations.
- Prefer existing app, feature, shared, and module boundaries over new
  top-level folders.
