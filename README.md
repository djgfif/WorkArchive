# Work Archive

Milestone 4 adds email/password authentication and user-owned remote data while preserving the local-first guest workflow.

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
- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Refresh: `POST /api/auth/refresh`
- Current user: `GET /api/auth/me`
- Works collection: `GET/POST /api/works` (protected)
- Work detail: `GET/PATCH/DELETE /api/works/:id` (protected)
- Sync push: `POST /api/sync/push` (protected)
- Sync pull: `POST /api/sync/pull` (protected)

## Guest And Account Mode

- Guest mode remains available with no login required.
- Guest data lives in its own local IndexedDB archive and never requires the backend.
- Signing in opens a separate local IndexedDB archive for that authenticated user on the same device.
- Signing out returns the app to the guest-local archive.

## Manual Sync

- The web app remains local-first. Creates, updates, and deletes write to IndexedDB first.
- Local work changes enqueue sync records in Dexie and stay visible immediately in the UI.
- Manual sync is available only while signed in because remote works and sync routes are user-scoped.
- Guest data is not automatically imported into an account yet. Guest and authenticated local archives stay separate in Milestone 4.
