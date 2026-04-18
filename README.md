# Work Archive

Milestone 3 connects the local-first web app and the NestJS API with a manual queue-based sync flow.

## Workspace Layout

- `apps/web`: React + TypeScript + Vite frontend scaffold
- `apps/api`: NestJS + Prisma API scaffold targeting PostgreSQL
- `packages/shared-types`: shared TypeScript package for cross-app contracts
- `packages/eslint-config`: reusable ESLint flat configs
- `packages/tsconfig`: reusable TypeScript base configs

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop with WSL integration enabled

## Getting Started

```bash
npm install
docker compose up -d
npm run dev
```

Docker Compose uses the root [`compose.yml`](/mnt/c/CodeStorage/WorkArchive/compose.yml) file.

## Environment Files

- Root template: [`.env.example`](/mnt/c/CodeStorage/WorkArchive/.env.example)
- API local defaults: [`apps/api/.env.example`](/mnt/c/CodeStorage/WorkArchive/apps/api/.env.example)

Milestone 0 keeps a local `apps/api/.env` so `npm install` can generate the Prisma client without extra setup. Replace those defaults before any real deployment workflow.

The web app reads `VITE_API_BASE_URL` for manual sync requests and falls back to `http://localhost:3000/api`.

The default PostgreSQL database runs on `localhost:5432` with:

- database: `work_archive`
- user: `postgres`
- password: `postgres`

## Root Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Workspace Commands

```bash
npm run dev --workspace @work-archive/web
npm run dev --workspace @work-archive/api
npm run prisma:generate --workspace @work-archive/api
npm run prisma:migrate:dev --workspace @work-archive/api
npm run test:e2e --workspace @work-archive/api
```

## Local Endpoints

- API health check: `GET /health`
- Swagger UI: `/docs`
- Works collection: `GET/POST /api/works`
- Work detail: `GET/PATCH/DELETE /api/works/:id`
- Sync push: `POST /api/sync/push`
- Sync pull: `POST /api/sync/pull`

## Manual Sync

- The web app remains local-first. Creates, updates, and deletes write to IndexedDB first.
- Local work changes enqueue sync records in Dexie and stay visible immediately in the UI.
- Open `/sync` in the web app to inspect queued items, conflict-marked works, the last pull cursor, and to run a manual push + pull cycle.
