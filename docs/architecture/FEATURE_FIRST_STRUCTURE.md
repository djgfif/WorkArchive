# Feature-First Project Structure

| Field                 | Value                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| Status                | `canonical`                                                                  |
| Role                  | `architecture boundary guide`                                                |
| Source of truth       | Current `apps/web`, `apps/api`, and `packages/*` layout                      |
| Last verified against | `2026-05-22` working tree                                                    |
| When to update        | Feature folders, module boundaries, or cross-feature dependency rules change |

Work Archive uses a feature-first monorepo layout. The root keeps operational
entrypoints, `apps/*` contains runnable applications, `packages/*` contains
shared workspace packages, and `docs/*` contains product, architecture, design,
and operations documentation.

## Root Layout

The repository root is intentionally small. Keep only operational entrypoints,
workspace manifests, Compose files, environment templates, and top-level tool
configuration there. Platform-specific convenience launchers live under
`scripts/windows`, deployment helpers under `scripts/deploy`, and security
checks under `scripts/security`.

Current documentation lives in its topic folder. Historical project references
and generated design drafts live under `docs/archive` so they are not mistaken
for implementation guidance.

## Web Boundaries

Web features live under `apps/web/src/features/{feature}`. A feature may keep
its internal `pages`, `components`, `hooks`, `services`, `utils`, and `db`
folders, but external feature imports should use the feature `index.ts`
entrypoint instead of reaching into deep implementation paths.
Low-level cross-feature runtime dependencies that would otherwise create
barrel import cycles may expose a narrow public sub-entrypoint, such as
`works/storage`, `works/data`, `sync/queue`, or `tier-boards/data`.

Web source imports may use these aliases:

- `@app/*` for `apps/web/src/app/*`
- `@features/*` for `apps/web/src/features/*`
- `@shared/*` for `apps/web/src/shared/*`
- `@test/*` for `apps/web/src/test/*`

`npm run check:web-boundaries` enforces that cross-feature imports target a
feature entrypoint or an approved sub-entrypoint. `npm run
check:web-import-cycles` resolves both relative imports and these aliases.

Current dependency direction:

- `home` and `profile` compose user-facing surfaces from `auth`, `archive`,
  `sync`, and `works`.
- `archive` and `sync` may depend on the `works` local database because IndexedDB
  is the local-first source of truth.
- `works` may depend on `auth`, `imports`, and `sync` for authenticated actions,
  quick-add search, and sync queueing.
- Shared UI/runtime utilities live under `apps/web/src/shared` and must not
  depend on feature implementation details unless the dependency is an explicit
  adapter boundary.

## API Boundaries

API features live under `apps/api/src/modules/{module}`. Each module has an
`index.ts` entrypoint for its public Nest boundary. Module internals may keep
DTOs and helpers in subfolders; other modules should prefer the module entrypoint
or the specific Nest provider only when a dependency is intentional.

Do not add API runtime path aliases unless the Node runtime loader is changed
at the same time. The API currently compiles with `tsc` and runs
`node dist/main.js`, so relative runtime imports keep production startup simple.

Large modules are split by responsibility:

- `imports`: candidate normalization/ranking, provider contracts, diagnostics,
  credential storage, and runtime provider state.
- `sync`: request/response DTOs, entity payload DTOs, controller, and service.
- `common`, `config`, `prisma`, and `security` are platform layers and may be
  used by feature modules.

## Public Repository Layout

Keep root files focused on running and operating the project. Design references,
frontend guides, and historical planning documents belong under `docs/`. Local
runtime files, IDE state, logs, build outputs, and non-example env files must
stay ignored and uncommitted.
