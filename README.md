# Work Archive

Work Archive is a local-first web app for organizing reading and viewing records
for novels, animation, comics, light novels, and web novels. The browser keeps
the primary archive in IndexedDB, and signed-in users can sync their local
archive through the API.

## Stack

- Web: React, Vite, TypeScript, Mantine, Dexie, React Router
- API: NestJS, Prisma, PostgreSQL
- Monorepo: npm workspaces with shared TypeScript and ESLint packages
- Runtime: Docker Compose for local full-stack development

## Repository Layout

| Path                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| [`apps/web`](./apps/web)   | React/Vite client                                             |
| [`apps/api`](./apps/api)   | NestJS API and Prisma schema                                  |
| [`packages`](./packages)   | shared types, ESLint config, TypeScript config                |
| [`scripts`](./scripts)     | development, deployment, and security automation              |
| [`docs`](./docs/README.md) | architecture, operations, security, and project documentation |

## Start Locally

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
cp .env.compose.example .env.compose
npm run dev:start
```

The repository runtime is pinned in [`.nvmrc`](./.nvmrc). Root verification and
dev scripts check the Node/npm version before running.

Default local endpoints:

- Web: [http://localhost:18730](http://localhost:18730)
- API health: [http://localhost:18731/health](http://localhost:18731/health)
- API docs: [http://localhost:18731/docs](http://localhost:18731/docs)

Stop the local stack:

```bash
npm run dev:stop
```

Host-based watch mode, Windows helper launchers, and environment file details
are documented in
[`docs/getting-started/LOCAL_DEVELOPMENT.md`](./docs/getting-started/LOCAL_DEVELOPMENT.md).

## Public Repository Safety

Before making or keeping this repository public, run:

```bash
npm run security:install-hooks
npm run security:secrets
npm run security:public
git ls-files -ci --exclude-standard
```

The repository must not track real `.env` files, provider keys, database dumps,
logs, browser traces, backup archives, local IDE state, or machine-specific
paths. The secret scanner prints only redacted path/line findings; it must not
print secret values. See
[`docs/security/PUBLIC_REPOSITORY_READINESS.md`](./docs/security/PUBLIC_REPOSITORY_READINESS.md)
for the full checklist.

## Documentation

- [`docs/README.md`](./docs/README.md) is the documentation index.
- [`docs/architecture/FEATURE_FIRST_STRUCTURE.md`](./docs/architecture/FEATURE_FIRST_STRUCTURE.md)
  defines the web/API structure boundaries.
- [`docs/operations/RUNBOOK.md`](./docs/operations/RUNBOOK.md) covers runtime
  operations and incident response.
- [`SECURITY.md`](./SECURITY.md) covers security reporting and disclosure.

## License

No open-source license has been granted. The source is visible for review, but
all rights are reserved unless a future license is added.
