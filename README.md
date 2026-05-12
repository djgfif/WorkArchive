# Work Archive

| Field                 | Value                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| Status                | `active`                                                                        |
| Role                  | `operational entrypoint`                                                        |
| Source of truth       | `package.json`, `compose.yml`, `compose.prod.yml`, `apps/web/package.json`, `apps/api/package.json` |
| Last verified against | `2026-04-25` local `master` working tree                                        |
| When to update        | 실행 스크립트, 환경 변수, 포트, Compose 흐름, 현재 검증 상태가 바뀔 때          |

Work Archive는 소설, 애니, 만화, 라이트노벨, 웹소설 등 작품 감상 기록을 관리하는 local-first 웹 서비스다. 프론트는 IndexedDB를 1차 저장소로 사용하고, 로그인 시 계정별 로컬 아카이브와 수동 동기화를 사용할 수 있다.

## Current Stack

Sync policy note: logged-in users can use the manual Sync page, and the web runtime also performs limited automatic sync: initial/auth-scope pull, focus/online pull, and debounced push after `syncQueue` changes. Conflict auto-merge is not implemented; conflicts remain visible and manually resolvable on the Sync page.

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
2. [`plan.md`](./plan.md)
3. [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
4. 작업 영역에 따라 [`docs/frontend/README.md`](./docs/frontend/README.md), [`docs/backend/README.md`](./docs/backend/README.md), [`docs/product/README.md`](./docs/product/README.md)

## Prerequisites

- Node.js `22+`
- npm `10+`
- Docker Desktop 또는 Docker Engine with Compose

## Environment Files

| Path                                                                     | Use                                     |
| ------------------------------------------------------------------------ | --------------------------------------- |
| [`.env.example`](/mnt/c/work/WorkArchive/.env.example)                   | `docker compose up --build`용 루트 설정 |
| [`apps/api/.env.example`](/mnt/c/work/WorkArchive/apps/api/.env.example) | 호스트 기반 API 개발용 설정             |
| [`apps/web/.env.example`](/mnt/c/work/WorkArchive/apps/web/.env.example) | 호스트 기반 웹 개발용 설정              |

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

## External Search Providers

Quick Add 외부 검색은 현재 아래 두 축으로 동작한다.

- user-scoped: `Aladin`은 로그인한 계정 설정에서 TTBKey를 저장해 사용한다.
- server-scoped: `TMDB_API_READ_TOKEN` 또는 `TMDB_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `KOBIS_API_KEY`

공개 키가 필요 없는 `AniList`, `Google Books`, `Open Library`, `TVmaze`, `manual` provider도 현재 코드에 연결돼 있다.

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

- Web: [http://127.0.0.1:53173](http://127.0.0.1:53173)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

- OpenAPI JSON: [http://localhost:3000/docs/openapi.json](http://localhost:3000/docs/openapi.json)

Windows 메모:

- 일부 Windows 환경에서는 `5173`/`5174`가 excluded port range에 걸릴 수 있다.
- 현재 `apps/web/vite.config.ts`는 개발용 Web port를 `53173`으로 지정한다.
- Host 기반 개발 접속 주소는 [http://127.0.0.1:53173](http://127.0.0.1:53173)을 기준으로 한다.

## Docker Compose

Production compose note: `compose.yml` is for local development only and must not be used for production. Production deployments must use [`compose.prod.yml`](/mnt/c/work/WorkArchive/compose.prod.yml), which requires explicit secrets and production URLs with `${VAR:?required}` and locks `SWAGGER_ENABLED=false`, `PASSWORD_RESET_DEV_LINKS_ENABLED=false`, and `COOKIE_SECURE=true`.

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
npm run test:integration
npm run build
```

Integration test note: `npm run test:integration` requires a migrated PostgreSQL database and a `DATABASE_URL` that includes `test` or `integration`. Run `npm run db:migrate:deploy` against that database first. The reset helper refuses to truncate a generic local or production database.

## Current Verification Status

- `npm run lint`: `2026-05-05` 통과 확인
- `npm run typecheck`: `2026-05-05` 통과 확인
- `env TMPDIR=/tmp npm run test`: `2026-05-05` 기준 API `13` suites / `102` tests, web `23` files / `141` tests 통과 확인
- `npm run build`: `2026-05-05` 통과 확인. Vite manual chunk 순환 경고는 있으나 빌드는 성공한다.
- GitHub Actions `validate` workflow는 PR/push에서 lint/typecheck/test/build를 실행하도록 `.github/workflows/validate.yml`에 존재한다. Required checks 적용은 GitHub repository setting에서 관리한다.
- `docker compose --env-file .env.example up --build -d`: `2026-04-24` 기준 이 세션에서는 미검증. 현재 WSL distro에서 `docker`가 없고, `docker.exe`도 `dockerDesktopLinuxEngine` pipe에 연결되지 않았다.

## Current Product Reality

- Sync policy: manual Sync page plus limited automatic sync for authenticated users. Automatic pull runs on account archive activation and browser focus/online events; automatic push runs after local `syncQueue` changes with debounce.
- Conflict policy: automatic conflict merge is not implemented. Failed/conflict items are kept for SyncPage retry, remote-apply, local-keep, or field-level merge resolution.
- Auth session policy: the backend currently stores one `refreshTokenHash` per user, so multi-device refresh sessions and device-level logout are follow-up work.

- 게스트 모드는 항상 사용 가능하며 IndexedDB에만 저장된다.
- 로그인 시 계정별 로컬 아카이브로 전환되고, 수동 Sync page와 로그인 상태의 제한적 자동 sync를 사용할 수 있다.
- 로그인 직후 guest 기록이 감지되면 `/account/transfer`에서 중복 후보를 검토한 뒤 선택 import할 수 있다.
- Quick Add의 기본 진입은 검색 없는 직접 추가이며, 수동 저장은 `catalogTitleId: null`, `importDraft: null`로 local-first 저장된다.
- Quick Add 외부 검색은 `/imports/search` optional auth 경로를 사용한다. 토큰이 있으면 authenticated request를 보내고, 토큰이 없으면 plain request로 key가 필요 없는 provider를 검색한다.
- 현재 `Aladin`, `AniList`, `Google Books`, `Open Library`, `TVmaze`, `TMDB`, `Naver Book`, `Kakao Book`, `KOBIS`, `manual` provider 구조가 연결돼 있다.
- Guest 검색은 현재 `credentialMode: none` provider 중심으로 허용된다. `Aladin` 같은 user-scoped provider는 로그인과 사용자 키가 필요하고, server-key provider의 guest 공개는 아직 정책 검토 대상이다.
- Quick Add 저장은 현재 제품 기준에서 의도적으로 local-first 경로를 유지한다. 선택한 후보는 Dexie `works` 레코드와 `syncQueue`에 먼저 반영되고, authenticated 생성도 서버 direct create가 아니라 동기화 경로를 탄다.
- Quick Add matched external candidate는 local record에 `catalogTitleId`를 저장하고 `importDraft`는 `null`로 둔다.
- Quick Add unmatched external candidate는 `importDraft`에 external identity만 저장한다. `title`, `author`, `description`, `thumbnailUrl`, `genres`는 `importDraft`에 중복 저장하지 않는다.
- Quick Add `manual` / `preview-manual` 후보는 catalog identity 없이 현재 draft를 local-first로 저장한다.
- duplicate detection 우선순위는 `catalogTitleId -> externalRefs -> title fallback`으로 테스트 고정돼 있다.
- Quick Add 검색 ranking은 제목 exact/alias/token, 제작자, 발매연도, provider/source coverage, catalog match를 반영한다.
- Settings provider readiness UI는 `/imports/providers` 기반 기본 구현과 테스트가 들어갔다. 남은 작업은 provider별 실제 검색어 QA와 polish다.
- SyncPage는 pending / failed / conflict queue item의 상태, 원인, 기록 보기, 재시도 CTA를 표시한다. conflict는 로컬 유지, 원격 적용, 필드별 병합으로 기본 해결할 수 있다.
- Works 목록 조회는 Dexie v7의 scope index를 사용해 active/trash 범위를 먼저 좁힌 뒤 필터와 정렬을 적용한다.
- manual timeline entries는 Dexie v9 sync-ready 모델과 backend `UserTimelineEntry` private storage를 통해 optional account sync 대상에 포함된다.
- JSON 백업은 schema/source/exclusion metadata와 timeline entries를 포함하고, 가져오기는 dry-run preview로 add/update/duplicate/skip/conflict 예상치를 먼저 보여준다.
- `Tier Boards`, `Insights`, `Community`는 현재 placeholder 성격이 강하다.
- 인증은 현재 이메일/비밀번호 + memory-only access token + `HttpOnly` refresh cookie 구조다. 앱 부팅 시 refresh cookie로 access token을 재발급하고, 실패하면 guest/local-first 상태로 돌아간다. 늦게 도착한 startup refresh 실패는 완료된 login/register 세션을 덮어쓰지 않는다.
- 백엔드는 이미 `CatalogWork` + `UserWorkRecord` split model을 도입했고, 현재 `Works` API는 flat compatibility 계층으로 유지된다.
- 현재 프론트 실행 대상은 `apps/web`이며, Tauri shell은 아직 저장소에 없다.

## Known Limitations

- 자동 동기화는 제한적으로 동작한다. 로그인 상태에서 초기/account scope pull, focus/online pull, `syncQueue` 변경 후 debounced push를 수행하며, 자동 conflict merge는 아직 없다.
- guest -> account 이관은 검토/선택 import 단계까지만 있고, 자동 병합이나 다기기 정책은 아직 없다.
- Quick Add provider readiness, duplicate detection, ranking/search quality 기본 구현/테스트는 들어갔지만, provider별 실제 검색어 QA와 UI polish는 후속 작업이다.
- Sync conflict 기본 해결 UX와 failed 원인 분류는 들어갔지만, 자동 병합 판단이나 고급 충돌 정책은 후속 작업이다.
- authenticated direct create path는 “미구현 경로”가 아니라 현재 제품 기준에서 채택하지 않는 경로다. 현재 기본 저장 경로는 local-first sync다.
- `Works` compatibility layer, 공개 레이어 권한 분리 같은 후속 과제는 아직 남아 있다.

## Documentation

- 문서 허브: [`docs/README.md`](./docs/README.md)
- 현재 실행 기준: [`plan.md`](./plan.md)
- 현재 코드 현실: [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- 프론트 기준: [`docs/frontend/FRONTEND_BLUEPRINT_V1.md`](./docs/frontend/FRONTEND_BLUEPRINT_V1.md)
- 프론트 상세 실행 계획: [`docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- 백엔드 목표 구조: [`docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](./docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 문서 운영 기준: [`docs/management/DOCUMENTATION_GOVERNANCE.md`](./docs/management/DOCUMENTATION_GOVERNANCE.md)
