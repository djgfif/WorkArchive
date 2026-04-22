# Work Archive

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `operational entrypoint` |
| Source of truth | `package.json`, `compose.yml`, `apps/web/package.json`, `apps/api/package.json` |
| Last verified against | `2026-04-22` working tree |
| When to update | 실행 스크립트, 환경 변수, 포트, Compose 흐름, 현재 검증 상태가 바뀔 때 |

Work Archive는 소설, 애니, 만화, 라이트노벨, 웹소설 등 작품 감상 기록을 관리하는 local-first 웹 서비스다. 프론트는 IndexedDB를 1차 저장소로 사용하고, 로그인 시 계정별 로컬 아카이브와 수동 동기화를 사용할 수 있다.

## Current Stack

- Frontend: React `19.1`, Vite `6.3`, TypeScript `5.8`, Mantine `7`, Dexie, React Router `7`
- API: NestJS `11`, Prisma `6.6`, PostgreSQL
- Monorepo: npm workspaces
- Shared packages: `packages/shared-types`, `packages/eslint-config`, `packages/tsconfig`

## Workspace Layout

- `apps/web`: React + TypeScript + Vite 프론트엔드
- `apps/api`: NestJS + Prisma + PostgreSQL API
- `packages/shared-types`: 프론트/백엔드 공유 타입
- `packages/eslint-config`: 공용 ESLint 설정
- `packages/tsconfig`: 공용 TypeScript 설정

## Read This Next

1. [`docs/README.md`](./docs/README.md)
2. [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. 작업 영역에 따라 [`docs/frontend/README.md`](./docs/frontend/README.md), [`docs/backend/README.md`](./docs/backend/README.md), [`docs/product/README.md`](./docs/product/README.md)

## Prerequisites

- Node.js `22+`
- npm `10+`
- Docker Desktop 또는 Docker Engine with Compose

## Environment Files

| Path | Use |
| --- | --- |
| [`.env.example`](/mnt/c/work/WorkArchive/.env.example) | `docker compose up --build`용 루트 설정 |
| [`apps/api/.env.example`](/mnt/c/work/WorkArchive/apps/api/.env.example) | 호스트 기반 API 개발용 설정 |
| [`apps/web/.env.example`](/mnt/c/work/WorkArchive/apps/web/.env.example) | 호스트 기반 웹 개발용 설정 |

권장 초기화:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

메모:

- 로컬 API 개발은 `apps/api/.env`의 `localhost` 기준 설정을 사용한다.
- Compose는 루트 `.env`의 `postgres` 서비스 호스트명을 사용한다.
- 웹은 `apps/web/.env`가 없어도 `http://localhost:3000/api`를 기본 API URL로 사용한다.

## Host-Based Development

1. 의존성 설치

```bash
npm install
```

2. PostgreSQL 시작

```bash
npm run dev:db
```

3. 기존 마이그레이션 적용

```bash
npm run db:migrate:deploy
```

4. 선택: 데모 계정과 샘플 데이터 시드

```bash
npm run db:seed
```

기본 데모 계정:

- email: `demo@workarchive.local`
- password: `demo-password-123`

5. 웹과 API 실행

```bash
npm run dev
```

개별 실행:

```bash
npm run dev:web
npm run dev:api
```

기본 엔드포인트:

- Web: [http://localhost:5173](http://localhost:5173)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)
- OpenAPI JSON: [http://localhost:3000/docs/openapi.json](http://localhost:3000/docs/openapi.json)

## Docker Compose

전체 스택을 컨테이너로 올릴 수 있다.

```bash
docker compose up --build
```

또는:

```bash
npm run compose:up
```

기본 엔드포인트:

- Web: [http://localhost:8080](http://localhost:8080)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

메모:

- Compose 파일은 [`compose.yml`](/mnt/c/work/WorkArchive/compose.yml)이다.
- 기본 `API_PORT`는 `3000`, `WEB_PORT`는 `8080`이다.
- `API_PORT`를 바꾸면 루트 `VITE_API_BASE_URL`도 맞춰야 한다.
- `WEB_PORT`를 바꾸면 `CORS_ORIGIN`도 맞춰야 한다.

## Common Commands

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run dev:db
npm run db:migrate:deploy
npm run db:seed
npm run lint
npm run typecheck
npm run test
npm run build
```

## Current Verification Status

- `npm run typecheck`: `2026-04-21` 기준 통과 확인
- `npm run test`: 스크립트는 존재하지만 이번 문서 정리 패스에서는 30초 타임박스 내 완료 여부를 재확정하지 못함
- `npm run test --workspace @work-archive/web`: `2026-04-21` 기준 `13 files`, `39 tests` 통과 확인
- `npm run test --workspace @work-archive/api`: 동일

## Current Product Reality

- 게스트 모드는 항상 사용 가능하며 IndexedDB에만 저장된다.
- 로그인 시 계정별 로컬 아카이브로 전환되고 수동 sync를 사용할 수 있다.
- 로그인 직후 guest 기록이 감지되면 `/account/transfer`에서 중복 후보를 검토한 뒤 선택 import할 수 있다.
- Quick Add 흐름은 존재하지만 외부 메타데이터 API 연동은 아직 없다.
- `Tier Boards`, `Insights`, `Community`는 현재 placeholder 성격이 강하다.
- 인증은 현재 이메일/비밀번호 + access token local storage + refresh cookie 구조다.
- 백엔드는 이미 `CatalogWork` + `UserWorkRecord` split model을 도입했고, 현재 `Works` API는 flat compatibility 계층으로 유지된다.
- 현재 프론트 실행 대상은 `apps/web`이며, Tauri shell은 아직 저장소에 없다.

## Known Limitations

- 자동 동기화는 아직 없다.
- guest -> account 이관은 검토/선택 import 단계까지만 있고, 자동 병합이나 다기기 정책은 아직 없다.
- Quick Add는 preview seam만 존재하고 외부 metadata truth source는 아직 없다.
- `Works` compatibility layer, access token 저장 구조, 공개 레이어 권한 분리 같은 후속 과제는 아직 남아 있다.

## Documentation

- 문서 허브: [`docs/README.md`](./docs/README.md)
- 현재 코드 현실: [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- 프론트 기준: [`docs/frontend/FRONTEND_BLUEPRINT_V1.md`](./docs/frontend/FRONTEND_BLUEPRINT_V1.md)
- 프론트 상세 실행 계획: [`docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- 백엔드 목표 구조: [`docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](./docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 문서 운영 기준: [`docs/management/DOCUMENTATION_GOVERNANCE.md`](./docs/management/DOCUMENTATION_GOVERNANCE.md)
