# AGENTS.md

Operating guide for AI agents (Claude Code, Codex, Cursor, etc.) working in this
repository. Human contributors should read [`CONTRIBUTING.md`](./CONTRIBUTING.md)
and [`README.md`](./README.md) first; this file captures the conventions an agent
must not rediscover each session.

## What this project is

Work Archive is a **local-first** web app for tracking reading/viewing records
(novels, anime, manga, light novels, web novels, films). The browser holds the
primary archive in **IndexedDB (Dexie)**; signed-in users sync that local
archive through the API. Treat IndexedDB as the source of truth on the client.

- **Web** — React 19, Vite, TypeScript, Mantine, Dexie, React Router (`apps/web`)
- **API** — NestJS 11, Prisma, PostgreSQL (`apps/api`)
- **Shared** — `packages/*` (shared-types, eslint-config, tsconfig)
- **Runtime** — Docker Compose for local full-stack; npm workspaces monorepo

## Environment

- Node **>=22.18.0**, npm **>=10.9.0** (see `engines` in `package.json`).
- This repo is developed under **WSL**. Keep `.env*`, `*.sh`, and config files
  as **LF** — `.gitattributes` enforces `.env* text eol=lf`. A stray `\r` in
  `.env.compose` breaks `npm run dev:start` with `$'\r': command not found`.

## Commands

Run from the repo root unless noted. Prefer the smallest relevant check while
developing; run the full set before declaring work done.

| Task | Command |
| --- | --- |
| Start full stack (Docker) | `npm run dev:start` → web `:18730`, API `:18731` |
| Stop full stack | `npm run dev:stop` |
| Web dev server only | `npm run dev:web` (Vite, `:5173`) |
| Lint (all workspaces) | `npm run lint` |
| Typecheck (all workspaces) | `npm run typecheck` |
| Unit tests | `npm run test` |
| API e2e / integration | `npm run test:e2e` · `npm run test:integration` |
| Web e2e (Playwright) | `npm run test:e2e:web` |
| Feature boundary check | `npm run check:web-boundaries` |
| Import cycle check | `npm run check:web-import-cycles` |
| Doc link check | `npm run check:docs-links` |
| Public-repo safety | `npm run security:public` |
| Regenerate API client | `npm run api:generate` (Orval) |

**Before finishing any code change:** `npm run lint && npm run typecheck &&
npm run test`. Lint runs after tests in this repo's history have caught unused
helpers left behind by edits — do not skip it.

## Architecture boundaries

Authoritative doc: [`docs/architecture/FEATURE_FIRST_STRUCTURE.md`](./docs/architecture/FEATURE_FIRST_STRUCTURE.md).

**Web** — features live under `apps/web/src/features/{feature}` with internal
`pages/ components/ hooks/ services/ utils/ db/`. Cross-feature imports must go
through the feature `index.ts`, or an approved narrow sub-entrypoint
(`works/storage`, `works/data`, `sync/queue`, `tier-boards/data`). Use aliases:
`@app/*`, `@features/*`, `@shared/*`, `@test/*`. `@shared` must not depend on
feature internals.

Dependency direction: `home`/`profile` compose from `auth`, `archive`, `sync`,
`works`; `archive`/`sync` may read the `works` IndexedDB; `works` may use
`auth`, `imports`, `sync`.

**API** — modules under `apps/api/src/modules/{module}` each expose `index.ts`.
**Do not add API runtime path aliases** — the API compiles with `tsc` and runs
`node dist/main.js`; relative imports keep production startup simple.

When in doubt, prefer an existing boundary over a new top-level folder.

## Design system — "Studio"

The visual identity is **neutral slate + a single rationed indigo accent** — a
modern, mainstream product look. (Supersedes the earlier *Vellum Index* — warm
archival dark + editorial gold; kept in git history and `VELLUM_INDEX.png`.)
Full spec: [`docs/design/`](./docs/design/) (`STUDIO_PHILOSOPHY.md`).

- Tokens live in `apps/web/src/app/mantine-theme.ts` (`--app-*` CSS variables)
  and `apps/web/src/app/styles/global.css`. Change colors there, not inline.
- Core palette: shell `#0A0A0C` (dark) / `#FBFBFD` (light), card `#1C1C22` /
  `#FFFFFF`, indigo `#6366F1` / `#4F46E5`, text `#F4F4F6` / `#17171C`.
- **Indigo is rationed** — use it only for active filters/states, selection, and
  primary CTAs. Never as a general accent.
- **Amber is rating-only** — `--app-accent-warm` (`#FBBF24` / `#D97706`) is the
  star/rating colour; do not borrow it elsewhere.
- Fonts: Pretendard for both UI/body **and** display titles
  (`var(--app-font-display)`), JetBrains Mono for codes and numerals. No
  editorial serif.
- Numerals are tabular (`font-variant-numeric: tabular-nums`).

## Conventions & guardrails

- **Korean UI copy.** User-facing strings are Korean; keep tone consistent with
  existing screens. Tests assert on exact Korean text — update tests and UI
  together.
- **Never commit secrets.** No real `.env` files, provider keys, DB dumps, logs,
  Playwright traces, screenshots with private data, or machine paths. Run
  `npm run security:public` before anything that affects repo publicness.
- **Doc discipline.** When you move files, change commands, or change security
  expectations, update the relevant doc and run `npm run check:docs-links`.
  Canonical docs carry a status table; respect "When to update".
- **Keep structure-only changes separate** from behavior changes in commits/PRs.
- **Verify visually when changing UI.** Build the web Docker image and screenshot
  `:18730`, or use the Vite dev server (`:5173`); don't rely on tests alone for
  layout/design work.

## Commit & PR

- Branch off the default branch; don't commit directly to it unless asked.
- End commit messages with the agent co-author trailer, e.g.
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Use `gh` for GitHub operations.

## Key references

- [`README.md`](./README.md) — quickstart and repo layout
- [`docs/README.md`](./docs/README.md) — documentation index
- [`docs/getting-started/LOCAL_DEVELOPMENT.md`](./docs/getting-started/LOCAL_DEVELOPMENT.md) — env files, host watch mode, Windows launchers
- [`docs/operations/RUNBOOK.md`](./docs/operations/RUNBOOK.md) — runtime ops
- [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) — current implemented state
- [`SECURITY.md`](./SECURITY.md) — disclosure policy
