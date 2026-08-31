# Feature-First Project Structure

| Field                 | Value                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| Status                | `canonical`                                                                  |
| Role                  | `architecture boundary guide`                                                |
| Source of truth       | Current `apps/web`, `apps/api`, and `packages/*` layout                      |
| Last verified against | `2026-08-25` Community alpha domain and local snapshot boundary               |
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
`works/storage`, `works/data`, `works/routes`, `sync/queue`, or
`tier-boards/data`.

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
- `community` may read active local works only through the `works` public
  entrypoint to build an explicit title/type/thumbnail publication snapshot. It
  must not import the works database directly or send personal record IDs or
  fields to the Community API.
- Shared UI/runtime utilities live under `apps/web/src/shared` and must not
  depend on feature implementation details unless the dependency is an explicit
  adapter boundary.

Large web services are split by responsibility when pure transformation logic
would otherwise obscure IndexedDB orchestration. For example, `archive` keeps
JSON archive types, parser/normalizer helpers, CSV serialization, import clone
helpers, preview counting, and ID remap plan generation outside
`local-archive.service.ts`, so the service remains focused on database reads,
writes, and transactions. `tier-boards` follows the same rule for board/lane/card
record-set builders used by delete, restore, duplicate, reorder, and template
application flows, with IndexedDB transaction and sync queue writes isolated in a
transaction writer outside `tier-board.service.ts`.

## API Boundaries

API features live under `apps/api/src/modules/{module}`. Each module has an
`index.ts` entrypoint for its public Nest boundary. Module internals may keep
DTOs and helpers in subfolders; other modules should prefer the module entrypoint
or the specific Nest provider only when a dependency is intentional.

Do not add API runtime path aliases unless the Node runtime loader is changed
at the same time. The API currently compiles with `tsc` and runs
`node dist/main.js`, so relative runtime imports keep production startup simple.

Large modules are split by responsibility:

- `auth`: `AuthService` owns user sessions, refresh-token rotation, profile
  updates, and auth account persistence. Provider-specific Google OAuth URL
  construction, token exchange, OIDC verification, and JWKS cache fallback live
  in `google-oauth-client.ts` so external-provider protocol details do not
  crowd session orchestration.
- `imports`: candidate normalization/ranking, provider contracts, diagnostics,
  credential storage, and runtime provider state.
- Import provider search is intentionally grouped by provider family:
  `import-provider-search.ts` is the dispatcher/fallback entrypoint, while
  `*-books`, `*-media`, `*-web`, `*-wikidata`, and `*-manual` hold provider
  execution details. Keep credential checks and provider-specific response
  parsing inside those family files instead of returning them to the service.
- `sync`: request/response DTOs, entity payload DTOs, controller, and service.
  `sync-push.service.ts` coordinates push execution; entity handlers own
  work/release/timeline/tier-board/graph behavior. Graph sync is split again
  into entity handlers, link handlers, validation helpers, result builders, and
  Prisma data builders so relationship ownership and parent validation stay
  isolated.
- `community`: public post reads plus authenticated publication, reaction,
  report, and moderation behavior. It owns only explicit community rows and
  public work snapshots. It must not import `UserRecordsService`, `SyncService`,
  provider credential services, or private archive models.
- `common`, `config`, `prisma`, and `security` are platform layers and may be
  used by feature modules.

### Works Compatibility Boundary

`WorksModule` is a compatibility façade over the split catalog/user-record
model. Keep it for existing flat `Work` response compatibility, but do not make
it the default home for new domain behavior.

- Put catalog identity, title/release metadata, and catalog submissions in
  `Catalog`.
- Put personal record mutations and user-owned record reads in `UserRecords`.
- Put provider search, candidate normalization, ranking, and credential
  readiness in `Imports`.
- Put local-first backup/pull/push contracts in `Sync`.

Flat `Works` responses are a deprecation candidate, not an immediate removal
target. Any deprecation must preserve sync create order
`catalogTitleId -> importDraft -> legacy fallback` until replacement clients
and tests are in place.

`CatalogWork` is still the compatibility record behind flat `Work` responses,
not the canonical shared catalog identity. Its `source` field records whether a
row is a legacy flat work (`legacy_flat`) or a user-owned snapshot of a
normalized catalog title (`catalog_title_snapshot`). Catalog metadata mutations
from `Works` and `Sync` may only update user-owned 1:1 compatibility records;
shared catalog identity and release metadata belong in `CatalogTitle` and
related catalog tables.

## Public Repository Layout

Keep root files focused on running and operating the project. Design references,
frontend guides, and historical planning documents belong under `docs/`. Local
runtime files, IDE state, logs, build outputs, and non-example env files must
stay ignored and uncommitted.
