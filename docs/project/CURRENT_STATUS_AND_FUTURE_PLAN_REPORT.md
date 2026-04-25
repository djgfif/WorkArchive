# CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `current reality` |
| Source of truth | `README.md`, `apps/web/src/app/router/routes.tsx`, `apps/web/src/features/works/db/work-archive.db.ts`, `apps/api/src/app.module.ts`, `apps/api/prisma/schema.prisma`, `apps/api/src/configure-app.ts`, `apps/api/src/modules/auth/auth.controller.ts`, package manifests |
| Last verified against | `2026-04-25` local `master` working tree |
| When to update | 실제 라우트, 저장 구조, API 모듈, 세션 저장 방식, 검증 표면, 현재 한계가 바뀔 때 |

이 문서는 Work Archive의 **현재 코드 기준 상태 보고서**다. 장기 비전과 확장 전략은 별도 로드맵 문서로 분리하고, 여기서는 지금 저장소가 실제로 무엇을 구현하고 있는지에만 집중한다.

## 1. Snapshot

- Work Archive는 작품 감상 기록을 관리하는 local-first 웹 서비스다.
- 프론트는 IndexedDB를 1차 저장소로 쓰고, 로그인 시 계정별 로컬 아카이브로 전환한다.
- 현재 저장소에서 실제 실행 가능한 프론트 런타임은 `apps/web`이며, Tauri shell은 아직 저장소에 없다.
- 백엔드는 NestJS + Prisma + PostgreSQL 기반 API다.
- Quick Add는 현재 `direct manual add + optional-auth server-assisted search + local-first save` 규칙으로 동작한다.
- Quick Add matched/unmatched/manual 저장 규칙과 duplicate detection 우선순위는 테스트로 고정돼 있다.
- 현재 sync는 수동 실행만 지원한다.
- `Tier Boards`, `Insights`, `Community`는 라우트는 존재하지만 아직 placeholder 성격이 강하다.

## 2. Verified Stack

### Frontend

- React `19.1`
- Vite `6.3`
- TypeScript `5.8`
- Mantine `7`
- Dexie
- React Router `7`
- Vitest + Testing Library

### Backend

- NestJS `11`
- Prisma `6.6`
- PostgreSQL
- Swagger
- Jest

### Workspace

- npm workspaces 모노레포
- `apps/web`, `apps/api`, `packages/shared-types`, `packages/eslint-config`, `packages/tsconfig`

## 3. Current Frontend Surface

### 3-1. Layout Boundaries

현재 프론트는 아래 4개 레이아웃 맥락으로 분리되어 있다.

- `MainProductLayout`
- `AuthLayout`
- `AccountLayout`
- `MinimalLayout`

### 3-2. Current Routes

| Area | Routes | Current state |
| --- | --- | --- |
| Main product | `/`, `/works`, `/works/new`, `/works/:id`, `/works/:id/edit`, `/tier-boards`, `/insights`, `/community`, `/profile` | 홈/작품 흐름은 실제 구현, 확장 목적지는 placeholder 성격 혼재 |
| Auth | `/auth/login`, `/auth/register` | 이메일/비밀번호 인증 구현 |
| Account | `/account`, `/account/sync`, `/account/transfer`, `/account/settings` | 계정 개요, sync, guest review, 설정 흐름 구현 |
| Compatibility redirects | `/sync`, `/settings`, `/profile/sync`, `/profile/settings` | `/account/*`로 리다이렉트 |
| Minimal | `*` | 404 처리 |

### 3-3. Current User Flows

- Home: 검색 진입, 빠른 추가, 통계 요약, 최근 기록 허브
- Works: 목록/필터/정렬/리스트-그리드 전환/휴지통 관리
- Work Create: `직접 추가 -> 저장`을 기본 경로로 제공하고, `검색 -> 선택 -> 자동 채움 검토 -> 개인 기록 입력 -> 저장`을 보조 Quick Add 흐름으로 제공
- Work Detail / Edit: 감상 기록 확인과 수정
- Auth: 회원가입 / 로그인
- Account: sync, 설정, guest 기록 검토/선택 import

### 3-4. Local Storage Model

Dexie DB는 현재 아래 테이블을 사용한다.

- `works`
- `releaseRecords`
- `syncQueue`
- `appMeta`

아카이브 스코프는 다음 두 종류다.

- guest: `work-archive-db-guest`
- user: `work-archive-db-user-{userId}`

즉, 게스트 기록과 로그인 사용자 기록은 현재 **의도적으로 분리된 로컬 아카이브**다.

## 4. Current Backend Surface

### 4-1. API Modules

- `PrismaModule`
- `AuthModule`
- `HealthModule`
- `CatalogModule`
- `UserRecordsModule`
- `ImportsModule`
- `WorksModule`
- `SyncModule`

### 4-2. Current Domain Model

Prisma 기준 핵심 모델은 현재 최소 아래 구조를 포함한다.

- `User`
- `CatalogWork`
- `Franchise`
- `CatalogTitle`
- `CatalogRelease`
- `Contributor`
- `CatalogExternalRef`
- `UserWorkRecord`
- `UserReleaseRecord`
- `ExternalApiCredential`

현재 백엔드는 이미 작품 메타데이터와 개인 기록을 물리적으로 분리했다. 다만 외부 계약은 아직 과도기적이다.

- `WorksService`는 현재도 flat `Work` 응답 계약을 유지한다.
- 내부적으로는 `CatalogService`와 `UserRecordsService`를 함께 오케스트레이션한다.
- `UserRecordsController`와 `CatalogController`는 이미 `CatalogTitle`/`CatalogRelease` 중심 read path를 일부 노출한다.
- 현재 생성/수정 흐름은 여전히 `CatalogWork`와 `UserWorkRecord`를 강하게 결합한 compatibility 단계를 포함한다.

즉, 현재 상태는 **monolithic `Work` 모델**이 아니라 **split domain + flat compatibility API**다.

### 4-3. Runtime Behavior

- 전역 prefix: `/api` (`/health`는 예외)
- Swagger: `SWAGGER_ENABLED` 기반으로 `/docs` 노출 여부 제어
- Health check: `/health`
- ValidationPipe: `transform + whitelist`
- `cookie-parser` 적용
- `helmet` 적용
- `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` rate limiting 적용
- `/api/sync/push`, `/api/sync/pull` rate limiting 적용
- CORS: `CORS_ORIGIN` 기반 explicit whitelist만 허용

### 4-4. Current Auth Session Shape

- 로그인/회원가입/refresh 응답은 access token과 사용자 정보를 반환한다.
- refresh token은 `HttpOnly` cookie로 저장된다.
- 프론트는 access token만 `localStorage`에 저장한다.
- API 요청은 `credentials: 'include'`를 사용해 refresh cookie를 함께 보낸다.

## 5. Current Product Capabilities

### Implemented

- 작품 생성 / 수정 / 상세 / soft delete / 복원
- 검색 / 필터 / 정렬
- 상태 / 별점 빠른 수정
- 게스트 모드
- 이메일/비밀번호 인증
- access token local storage + refresh cookie 세션 복구
- 사용자별 로컬 아카이브 분리
- 로그인 직후 guest 기록 검토 후 선택 import
- 검색 없이 제목/타입 중심으로 저장하는 직접 수동 추가
- 수동 sync queue와 push / pull
- optional-auth Quick Add provider 검색과 preview fallback
- guest no-user-key provider 검색
- Quick Add matched external candidate 저장 규칙: `catalogTitleId` 저장, `importDraft: null`
- Quick Add unmatched external candidate 저장 규칙: `title`, `author`, `description`, `thumbnailUrl`, `genres`를 중복 저장하지 않는 identity-only `importDraft`
- Quick Add `manual` / `preview-manual` 저장 규칙: catalog/import identity 없이 local draft 저장
- duplicate detection 우선순위: `catalogTitleId -> externalRefs -> title fallback`
- 계정 설정의 Aladin 키 저장/삭제
- `/imports/providers` 기반 provider readiness 조회와 Settings provider readiness 기본 UI/테스트
- SyncPage pending / failed / conflict queue item 표시, 원인 표시, 기록 보기, 재시도 CTA
- `CatalogTitle` related read model과 `UserReleaseRecord` 흐름
- 홈 허브 화면
- 계정 센터 라우트 분리
- backend sync create의 `catalogTitleId -> importDraft -> legacy fallback` 처리 순서
- `importDraft.catalogTitle` optional legacy-compatible field와 누락 시 `payload.title` fallback

### Not Yet Implemented

- provider별 ranking/search quality 개선
- provider readiness UI polish
- conflict overwrite/merge resolution
- guest 기록 자동 병합 정책과 다기기 이관 UX
- 자동 동기화
- 공개 프로필 / 공개 기록 / 작품 집계
- 실제 티어 보드 기능
- 커뮤니티 기능

## 6. Validation Surface

### Root Scripts

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

### Frontend Scripts

- `npm run dev --workspace @work-archive/web`
- `npm run build --workspace @work-archive/web`
- `npm run typecheck --workspace @work-archive/web`
- `npm run test --workspace @work-archive/web`

대표 테스트 표면:

- `src/app/App.test.tsx`
- `src/features/auth/pages/AuthFlow.test.tsx`
- `src/features/sync/pages/SyncPage.test.tsx`
- `src/features/works/pages/WorkDetailPage.test.tsx`
- `src/features/works/pages/WorkFlow.test.tsx`
- `src/features/works/pages/WorksListPage.test.tsx`

### Backend Scripts

- `npm run dev --workspace @work-archive/api`
- local Nest API 개발 실행은 초기 `tsc` 빌드 후 `tsc --watch` + `node --watch` 루프를 사용한다. `tsx watch`는 `emitDecoratorMetadata`를 만들지 못해 Swagger DTO 메타데이터가 깨질 수 있으므로 표준 개발 실행기로 사용하지 않는다.
- `npm run build --workspace @work-archive/api`
- `npm run typecheck --workspace @work-archive/api`
- `npm run test --workspace @work-archive/api`
- `npm run test:e2e --workspace @work-archive/api`

대표 테스트 표면:

- `test/app.module.spec.ts`
- `test/sync.service.spec.ts`
- `test/works.service.spec.ts`
- `test/works.e2e-spec.ts`

### Current Verification Status

- `npm run typecheck`: `2026-04-25` 통과 확인
- `npm run test --workspace @work-archive/web`: `2026-04-25` 기준 `18` files, `70` tests 통과 확인
- `npm run test --workspace @work-archive/api`: `2026-04-25` 기준 `7` suites, `45` tests 통과 확인
- `npm run build`: `2026-04-24` 통과 확인
- `docker compose --env-file .env.example up --build -d`: `2026-04-24` 기준 이 세션에서는 미검증. 현재 WSL distro에서 `docker`가 없고, `docker.exe` client도 `dockerDesktopLinuxEngine` pipe에 연결되지 않았다.

## 7. Immediate Limitations

### 7-1. Frontend

- Mantine foundation은 도입됐지만 스타일 책임은 아직 `global.css`와 페이지별 클래스 조합에 크게 남아 있다.
- shared UI primitives가 생기고 있지만 `var(--accent)`류 직접 참조와 커스텀 클래스 조합 의존이 여전히 크다.
- placeholder 화면과 실제 구현 화면의 성숙도 차이가 크다.
- 직접 수동 추가와 guest no-key provider 검색의 기본 구현/테스트는 들어갔다. 남은 일은 provider별 ranking/search quality와 UI polish다.
- Quick Add provider readiness UI와 duplicate policy의 기본 구현/테스트는 들어갔다.
- Quick Add 저장은 현재 제품 기준에서 의도적으로 local-first sync 경로를 유지한다. authenticated direct create path는 기본 생성 경로가 아니다.

### 7-2. Product UX

- 게스트와 계정 아카이브는 분리되어 있고, 현재는 로그인 직후 review/import 단계까지만 제공된다.
- sync는 수동이다.
- SyncPage는 pending / failed / conflict queue item 단위 상태와 원인, 기록 보기, 재시도 CTA를 제공한다.
- conflict overwrite/merge resolution은 아직 후속 작업이다.
- Profile / Tier Boards / Community / Insights는 장기 방향에 비해 현재 구현이 얕다.

### 7-3. Backend / Security

- `WorksModule`은 현재 호환성 계층이라서, 내부 split domain과 외부 flat 계약이 함께 유지되고 있다.
- 현재 catalog는 shared public catalog라기보다 user record와 강하게 결합된 `1:1` 과도기 구조다.
- sync create path는 `catalogTitleId -> importDraft -> legacy fallback` 순서로 테스트 고정돼 있다. `importDraft.catalogTitle`은 optional legacy-compatible field이며, 없으면 `payload.title`로 fallback한다.
- 장기적으로 sync create와 Quick Add import 흐름은 `Works` compatibility layer에서 더 멀어져야 한다.
- access token은 아직 브라우저 `localStorage`에 저장된다.
- 공개 레이어, 세션/디바이스 관리, 공개 데이터 권한 분리 같은 확장 전 과제는 아직 남아 있다.

## 8. Where To Read Next

- 프론트 현재 기준: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- 프론트 목표 구조: [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
- 프론트 상세 실행 로드맵: [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- 제품 near-term 우선순위: [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- 제품 비전: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- 인증/게스트 전략: [`../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
- 백엔드 목표 구조: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 보안 로드맵: [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)
