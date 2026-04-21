# CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `current reality` |
| Source of truth | `README.md`, `apps/web/src/app/router/routes.tsx`, `apps/web/src/features/works/db/work-archive.db.ts`, `apps/api/src/app.module.ts`, `apps/api/prisma/schema.prisma`, package manifests |
| Last verified against | `2026-04-21` working tree |
| When to update | 실제 라우트, 저장 구조, API 모듈, 검증 표면, 현재 한계가 바뀔 때 |

이 문서는 Work Archive의 **현재 코드 기준 상태 보고서**다. 장기 비전과 확장 전략은 별도 로드맵 문서로 분리하고, 여기서는 지금 저장소가 실제로 무엇을 구현하고 있는지에만 집중한다.

## 1. Snapshot

- Work Archive는 작품 감상 기록을 관리하는 local-first 웹 서비스다.
- 프론트는 IndexedDB를 1차 저장소로 쓰고, 로그인 시 계정별 로컬 아카이브로 전환한다.
- 백엔드는 NestJS + Prisma + PostgreSQL 기반 API이며 `Auth`, `Works`, `Sync`, `Health` 모듈을 제공한다.
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
- Work Create: `검색 -> 선택 -> 자동 채움 검토 -> 개인 기록 입력 -> 저장` 형태의 Quick Add 중심 흐름
- Work Detail / Edit: 감상 기록 확인과 수정
- Auth: 회원가입 / 로그인
- Account: sync, 설정, guest 기록 검토/선택 import

### 3-4. Local Storage Model

Dexie DB는 현재 아래 테이블을 사용한다.

- `works`
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
- `WorksModule`
- `SyncModule`

### 4-2. Current Domain Model

Prisma 기준 핵심 모델은 아직 아래 두 개다.

- `User`
- `Work`

현재 `Work` 모델은 다음을 함께 담고 있다.

- 작품 메타데이터
- 개인 기록 데이터
- soft delete 상태
- sync 상태와 서버 버전

즉, 장기적으로 분리되어야 할 공용 metadata와 개인 record가 아직 한 모델에 공존한다.

### 4-3. Runtime Behavior

- 전역 prefix: `/api` (`/health`는 예외)
- Swagger: `/docs`
- Health check: `/health`
- ValidationPipe: `transform + whitelist`
- CORS: `CORS_ORIGIN` 기반, 빈 값 또는 `*`에서는 wildcard fallback 허용

## 5. Current Product Capabilities

### Implemented

- 작품 생성 / 수정 / 상세 / soft delete / 복원
- 검색 / 필터 / 정렬
- 상태 / 별점 빠른 수정
- 게스트 모드
- 이메일/비밀번호 인증
- 사용자별 로컬 아카이브 분리
- 로그인 직후 guest 기록 검토 후 선택 import
- 수동 sync queue와 push / pull
- 홈 허브 화면
- 계정 센터 라우트 분리

### Not Yet Implemented

- 외부 메타데이터 API 기반 실제 Quick Add
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

- `npm run typecheck`: `2026-04-21` 기준 통과 확인
- `npm run test`: 스크립트 존재, 이번 패스에서는 전체 워크스페이스 완료 여부 미재확인
- `npm run test --workspace @work-archive/web`: `2026-04-21` 기준 `13` files, `39` tests 통과 확인
- `npm run test --workspace @work-archive/api`: 이번 패스에서는 완료 여부 미재확인

## 7. Immediate Limitations

### 7-1. Frontend

- Mantine foundation은 도입됐지만 스타일 책임은 아직 `global.css`에 크게 남아 있다.
- placeholder 화면과 실제 구현 화면의 성숙도 차이가 크다.
- Quick Add는 구조는 있지만 데이터 신뢰를 뒷받침할 외부 import가 없다.
- 현재 저장소에는 Tauri shell이 없고, 프론트 런타임은 웹 기준이다.

### 7-2. Product UX

- 게스트와 계정 아카이브는 분리되어 있고, 현재는 로그인 직후 review/import 단계까지만 제공된다.
- sync는 수동이다.
- Profile / Tier Boards / Community / Insights는 장기 방향에 비해 현재 구현이 얕다.

### 7-3. Backend / Security

- `Work` 모델이 과도하게 많은 책임을 갖는다.
- refresh/access token은 현재 브라우저 `localStorage`에 저장된다.
- 운영 보안 항목인 strict CORS, rate limiting, Swagger 제한은 아직 미적용이다.

## 8. Where To Read Next

- 프론트 현재 기준: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- 프론트 목표 구조: [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
- 프론트 Mantine 실행 계획: [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- 제품 near-term 로드맵: [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- 제품 비전: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- 인증/게스트 전략: [`../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
- 백엔드 목표 구조: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 보안 로드맵: [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)
