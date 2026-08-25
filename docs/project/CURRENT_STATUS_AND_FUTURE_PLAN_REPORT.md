# CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md

| Field                 | Value                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                | `canonical`                                                                                                                                                                                                                                                                                                                                            |
| Role                  | `current reality`                                                                                                                                                                                                                                                                                                                                      |
| Source of truth       | `README.md`, `apps/web/src/app/router/routes.tsx`, `apps/web/src/features/community`, `apps/web/src/features/works/db/work-archive.db.ts`, `apps/api/src/app.module.ts`, `apps/api/prisma/schema.prisma`, `apps/api/src/configure-app.ts`, `apps/api/src/modules/community`, package manifests                                                         |
| Last verified against | `2026-08-25` Community alpha repository implementation, focused authorization/publication tests, schema validation, and permission QA. Full local gates and real migrated desktop/mobile runtime evidence are recorded separately; production community host, moderation operator, retention, takedown, rollback, and release approval remain pending. |
| When to update        | 실제 라우트, 저장 구조, API 모듈, 세션 저장 방식, 검증 표면, 현재 한계가 바뀔 때                                                                                                                                                                                                                                                                       |

이 문서는 Work Archive의 **현재 코드 기준 상태 보고서**다. 장기 비전과 확장 전략은 별도 로드맵 문서로 분리하고, 여기서는 지금 저장소가 실제로 무엇을 구현하고 있는지에만 집중한다.

## 1. Snapshot

Sync policy correction: current code supports the Settings account backup
control surface plus automatic sync for authenticated users. `useAutoSync`
serializes account activation pull before queued push, drains push requests
without losing in-flight updates, and resumes pending work after browser availability returns. Narrow safe auto-merge is implemented for same-entity/non-delete collisions where scalar fields still match; overlapping scalar conflict merge and advanced multi-device policy remain unimplemented.

- Work Archive는 작품 감상 기록을 관리하는 local-first 웹 서비스다.
- 프론트는 IndexedDB를 1차 저장소로 쓰고, 로그인 시 계정별 로컬 아카이브로 전환한다.
- 현재 저장소에서 실제 실행 가능한 프론트 런타임은 `apps/web`이며, Tauri shell은 아직 저장소에 없다.
- 백엔드는 NestJS + Prisma + PostgreSQL 기반 API다.
- Quick Add는 현재 `modal-first direct manual add + optional-auth server-assisted search + local-first save` 규칙으로 동작한다.
- Quick Add matched/unmatched/manual 저장 규칙과 duplicate detection 우선순위는 테스트로 고정돼 있다.
- Quick Add 검색은 diagnostics, normalization, merge/dedupe, ranking, sourceCoverage를 갖추고 manual fallback을 일반 검색 결과에서 분리한다.
- 현재 sync는 Settings 계정 백업 섹션과 로그인 상태의 제한적 자동 sync를 함께 지원한다.
- Settings는 로컬 IndexedDB 원본, 자동 JSON 폴더 백업, 계정 백업/sync 상태, 원인별 sync recovery assistant, 서버 데이터 export/delete 계열 작업을 분리해 설명한다.
- `Tier Boards`는 작품 기록과 분리된 독립 보드 기능이다. `Insights`는 개인 기록 기반의 비공개 통계 화면이다. `Community`는 공개 읽기·로그인 쓰기의 별도 알파 화면이며, 로컬 기록을 자동 공개하지 않는다. 프로덕션 노출 승인은 아직 보류다.

## 2. Verified Stack

### Frontend

- React `19.2`
- Vite `6.3`
- TypeScript `6.0`
- Mantine `9.2`
- Dexie
- React Router `7`
- Vitest + Testing Library

### Backend

- NestJS `11`
- Prisma `7.8`
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

| Area                    | Routes                                                                                                                                                                     | Current state                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Main product            | `/`, `/works`, `/works/new`, `/works/:id`, `/works/:id/edit`, `/community`, `/insights`, `/tier-boards`, `/tier-boards/:boardId`, `/tier-boards/:boardId/view`, `/profile` | 홈/작품/커뮤니티/개인 인사이트 흐름과 독립 티어보드 기능            |
| Compatibility redirects | `/sync`, `/settings`, `/profile/sync`, `/profile/settings`, `/account/sync`                                                                                                | 현재 노출하지 않는 경로를 기존 안전 목적지로 리다이렉트             |
| Auth                    | `/auth/login`, `/auth/register`, `/auth/google/*`                                                                                                                          | Google OAuth 중심 인증 구현. legacy 이메일/비밀번호 경로는 비활성화 |
| Account                 | `/account`, `/account/transfer`, `/account/settings`                                                                                                                       | 계정 개요, guest review, 설정/data safety 흐름 구현                 |
| Minimal                 | `*`                                                                                                                                                                        | 404 처리                                                            |

### 3-3. Current User Flows

- Home: 검색 진입, 빠른 추가, 통계 요약, 최근 기록 허브
- Works: 목록/필터/정렬/리스트-그리드 전환/보기 모드 URL 유지/휴지통 관리
- Works / Work Create: `/works`에서는 `AddWorkDialog`로 작품 추가를 열고, `/works/new`는 같은 `QuickAddWorkForm` 흐름을 page fallback으로 제공한다. `직접 입력 -> 저장`이 기본 경로이며, `검색 -> 후보 선택 -> 입력 채우기 -> 개인 기록 확인 -> 저장`은 같은 dialog/page 안의 보조 흐름이다.
- Work Detail / Edit: 감상 기록 확인과 수정
- Community: 공개 피드 읽기, 로그인 사용자의 새 감상 공개, 스포일러 보호, 반응·신고·소유 게시물 삭제. 선택한 작품 표시 스냅샷 외의 개인 기록은 전송하지 않는다.
- Auth: Google OAuth 로그인 / 세션 복구. legacy 회원가입/이메일 로그인은 비활성화
- Account: sync, 설정/data safety, guest 기록 검토/선택 import

### 3-4. Local Storage Model

Dexie DB는 현재 아래 테이블을 사용한다.

- `works`
- `releaseRecords`
- `timelineEntries`
- `series`
- `workSeriesLinks`
- `contributors`
- `workContributors`
- `workRelations`
- `tierBoards`
- `tierLanes`
- `tierBoardCards`
- `tierBoardAssets`
- `syncQueue`
- `appMeta`

초기 tier board draft migration에서 쓰던 `tierBoardLanes` / `tierBoardItems`
스토어는 migration 호환 목적으로만 남아 있으며 현재 런타임 도메인은
`tierLanes` / `tierBoardCards`를 사용한다.

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

`SyncModule`은 현재 push/pull orchestration을 작은 서비스 유틸리티와
handler로 분해한 상태다. Pull 경로는 page loader, record/include 정의,
payload mapper, ordered change builder, summary utility로 나뉘고, Push 경로는
entity handler, validation/data builder, result/summary helper, dispatcher로
나뉜다. 외부 sync API 계약은 이 분해로 변경되지 않았다.

`ImportsModule`은 provider adapter/search/runtime/credential helper를 이미
별도 모듈로 두고 있으며, import 후보 resolve payload 정규화는
`resolve-import-candidate`, 내부 catalog 후보 검색/변환은
`internal-catalog-import-candidates`, 검색 단계 cache key/guard/cacheability는
`import-search-stage-cache`, provider readiness/status 계산은
`import-provider-readiness`, catalog match/existing record 후보 보강은
`import-candidate-decoration`, provider별 검색 실행/skip/failure/circuit side
effect는 `import-provider-search-runner`, stored/server credential lookup runtime은
`import-provider-credential-runtime`, cache를 포함한 provider search stage 실행은
`import-provider-search-stage`, provider 결과 diagnostics/summary/metric 조립은
`import-search-observability`, provider key 저장/삭제/연결 테스트는
`import-provider-key-management`, 검색 request context 확정은
`import-search-context`, 검색 후보 merge/ranking과 response assembly는
`import-search-result`로 분리했다. `ImportsService`는 여전히 검색 요청 전체
orchestration을 조율하지만, resolve payload 파싱, 내부 catalog 후보 변환, 검색
단계 캐시 판정과 provider stage 실행, provider readiness/status 계산, 후보 보강,
provider별 검색 실행, provider credential runtime 구성, 검색 관측 조립, provider
key management, 검색 context/result 조립 책임은 서비스 밖으로 이동했다.

Bearer access token header parsing은 `auth/bearer-token` helper가 담당한다.
`JwtAuthGuard`는 required token 추출을, optional-auth import 검색 경로는 optional
token 추출을 같은 helper로 공유한다.

Refresh session에 저장/표시하는 user agent 요약과 IP address 마스킹은
`auth-session-metadata` helper가 담당한다. 이 helper는 raw user agent 저장을
피하고, iPhone/iPad user agent를 macOS보다 iOS로 우선 판정한다.

Auth user response, Google auth account persistence payload, refresh session
response mapping은 `auth-response-mappers` helper가 담당한다.

`UserRecordsService`의 DTO date parsing, record medium 판정, recording policy
view 조립, grouped record key 산출, update/create/import/progress/release payload builder는
`user-records.helpers`가 담당한다.

`CatalogService`의 legacy `CatalogWork` genre 정규화와 legacy work 기반
`CatalogTitle` upsert payload 조립은 `catalog-legacy-work` helper가 담당한다.

`CatalogIngestionService`의 external ref/release candidate 정규화와 release
identity 판정은 `catalog-ingestion-normalization` helper가 담당한다.
`CatalogIngestionService`의 title/release update payload와 match view 변환은
`catalog-ingestion-payloads` helper가 담당한다.

`CatalogIngestionService`의 title/contributor/release-year match scoring과
catalog match 문자열 정규화는 `catalog-title-matching` helper가 담당한다.

`CatalogService`의 catalog submission 생성 payload, list query args,
moderation access guard, pending review guard는 `catalog-submissions` helper가
담당한다.

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

Production hardening baseline: production startup rejects development secrets (`change-me-*`, `local-compose-*`), short JWT/encryption secrets, localhost or non-HTTPS public CORS/Web/OAuth URLs, `postgres/postgres` database credentials, demo seed passwords, `SWAGGER_ENABLED=true`, and `COOKIE_SECURE=false`. Local `compose.yml` is development-only; production deployments use `compose.prod.yml` with required environment variables.

- 전역 prefix: `/api` (`/health`는 예외)
- Swagger: `SWAGGER_ENABLED` 기반으로 `/docs` 노출 여부 제어
- Health check: `/health`
- ValidationPipe: `transform + whitelist`
- `cookie-parser` 적용
- `helmet` 적용
- `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/data-export`, `/api/auth/account/deletion-preview`, `/api/auth/account` rate limiting 적용. 단, legacy login/register는 현재 `410 Gone`으로 비활성화. legacy `password-reset/*` 라우트와 rate limiter는 제거됨(이제 `404`)
- `/api/sync/push`, `/api/sync/pull` rate limiting 적용
- CORS: `CORS_ORIGIN` 기반 explicit whitelist만 허용
- Production Docker runtime: API는 `node` user로 실행하고 runtime image는
  pruned production dependencies, compiled `dist`, Prisma schema만 포함한다.
  Web은 unprivileged nginx `8080`으로 실행한다.
- Production compose: API/web은 read-only filesystem, tmpfs scratch path,
  `no-new-privileges`, healthcheck, restart policy, CPU/memory/pid limits를
  가진다.
- Prisma migration은 API entrypoint에서 실행하지 않는다. 배포 전
  `api-migrate` release profile job으로 실행한다.
- Retention cleanup은 `security_events`, `user_refresh_sessions`,
  `user_sync_applied_mutations`를 대상으로 별도 운영 명령에서 실행한다.
  기본은 dry-run이고 production delete는 명시 confirmation env가 필요하다.
- Provider 검색은 fetch timeout, 제한적 429 retry, provider별 cache/circuit
  state로 격리한다. `REDIS_URL`이 구성되면 provider cache/circuit state는
  Redis를 사용하고, Redis가 없는 비프로덕션 환경에서는 process-local
  memory로 fallback한다. KOBIS는 HTTP/query-key upstream 경계를 운영
  문서에 고정했다.

### 4-4. Current Auth Session Shape

Current session policy: refresh sessions are stored in `UserRefreshSession` / `user_refresh_sessions`. Google OAuth login creates a device-level refresh session, refresh rotates the hash in that session, and account settings can list sessions, revoke one session, or sign out all devices. The legacy `users.passwordHash` / `users.refreshTokenHash` columns and the `PasswordResetToken` model were removed in migration `20260606120000_drop_legacy_password_auth`; Google OAuth is the only supported provider. Refresh token reuse detection revokes all active sessions for the user.

- Google OAuth complete/refresh 응답은 access token과 사용자 정보를 반환한다. legacy email/password register/login 엔드포인트는 `410 Gone`으로 비활성화되어 있고, legacy API password-reset 라우트는 제거되어 `404`로 닫힌다.
- refresh token은 `HttpOnly` cookie로 저장된다.
- 프론트는 access token을 브라우저 storage에 저장하지 않고 메모리에만 둔다.
- 앱 부팅 시 기존 `work-archive.auth.tokens` local/session storage 값은 제거하고, refresh cookie로 access token을 재발급해 세션을 복구한다.
- refresh 실패나 네트워크 실패 시 프론트는 guest/local-first 상태로 돌아간다.
- AuthProvider는 startup refresh와 interactive auth completion이 겹치는 경우 늦게 도착한 startup 실패가 완료된 authenticated 세션을 guest로 되돌리지 않게 generation guard를 둔다.
- API 요청은 `credentials: 'include'`를 사용해 refresh cookie를 함께 보낸다.

## 5. Current Product Capabilities

### Implemented

- 작품 생성 / 수정 / 상세 / soft delete / 복원
- 검색 / 필터 / 정렬
- Works 보기 모드 URL 유지 (`/works?view=list`)
- 상태 / 별점 빠른 수정
- 게스트 모드
- Google OAuth 인증
- legacy 이메일/비밀번호 register/login `410 Gone` 비활성화, password-reset 라우트·컬럼·모델 완전 제거
- memory-only access token + refresh cookie 세션 복구
- 사용자별 로컬 아카이브 분리
- 로그인 직후 guest 기록 검토 후 선택 import
- 검색 없이 제목/타입 중심으로 저장하는 직접 수동 추가
- `/works`의 modal-first Add Work flow와 `/works/new` page fallback
- 수동 sync queue와 push / pull
- optional-auth Quick Add provider 검색과 preview fallback
- guest no-user-key provider 검색
- Quick Add matched external candidate 저장 규칙: `catalogTitleId` 저장, `importDraft: null`
- Quick Add unmatched external candidate 저장 규칙: `title`, `author`, `description`, `thumbnailUrl`, `genres`를 중복 저장하지 않는 identity-only `importDraft`
- Quick Add `manual` / `preview-manual` 저장 규칙: catalog/import identity 없이 local draft 저장
- Quick Add automatic search에서 `manual` / `preview-manual` 후보는 일반 후보 목록에 섞지 않고 직접 추가 fallback으로 분리
- duplicate detection 우선순위: `catalogTitleId -> externalRefs -> title fallback`
- 개인 태그 입력/표시/목록 검색·필터/export/import/sync payload 보존
- Dexie v7 works scope index와 active/trash scope-first 목록 조회
- Settings의 local archive JSON export/import, dry-run import preview, CSV export, 자동 폴더 백업 상태, 계정 백업/sync 상태 요약과 원인별 recovery assistant
- JSON export schema/source/exclusion metadata와 CSV export 컬럼 계약
- Dexie v9 timeline entry 저장 모델, Work Detail manual timeline add/delete, JSON export/import timeline 보존, optional account sync parity
- 작품 상태와 진행도가 실제로 바뀌면 자동 타임라인 이벤트를 작품·이벤트·sync queue
  단일 로컬 트랜잭션에서 기록한다. 같은 값을 다시 저장하면 이벤트를 만들지 않으며,
  자동 기록도 사용자가 삭제할 수 있고 JSON 백업과 선택형 계정 sync에서 source를 보존한다.
- 완료한 작품의 타임라인에서 소설·만화 계열은 `오늘 재독 기록`, 영상 계열은
  `오늘 재감상 기록`으로 바로 남길 수 있다. 같은 날짜의 빠른 중복 기록은 막고,
  과거 날짜와 메모는 고급 기록 추가를 사용한다.
- 개인 인사이트의 재독·재감상 섹션은 활성 반복 기록만 작품별로 집계해 전체 횟수,
  다시 찾은 작품 수, 올해 횟수, 최근 기록일과 상위 작품을 표시한다. 삭제 기록과
  삭제 작품은 제외하며, 아직 기록이 없으면 완료 작품 목록으로 안내한다.
- 개인 인사이트의 기록 리듬은 진행도·상태·수동 메모·재독·재감상을 최근 28일
  로컬 달력으로 집계해 활동일, 최근 7일 기록 수, 최근 기록일과 날짜별 농도를
  표시한다. 삭제·미래·잘못된 기록과 삭제 작품은 제외하고, `occurredAt`
  인덱스로 최근 범위와 최신 활성 작품 기록만 읽는다.
- 홈의 `이어볼 작품`은 진행 중인 애니·드라마·웹소설·웹툰에 매체별 다음 회차
  원클릭 기록을 제공한다. 저장 직전에 최신 로컬 작품을 다시 읽어 경계를 검증하고,
  기존 진행도 변경 트랜잭션을 통해 작품·자동 타임라인·두 sync queue 변경을 함께
  커밋한다. 완료·상한 도달·잘못된 진행도·미지원 매체에는 버튼을 노출하지 않는다.
- Data Ownership 정책: `appMeta`는 export metadata로만 다루고, `syncQueue`, auth token, refresh token, API key, Aladin TTBKey는 백업/복원 대상에서 제외
- Settings의 아카이브 건강검진: 활성 작품의 진행도 범위, 날짜 순서, 상태/날짜 일관성, 진행 단위, 표지 보강 필요를 로컬에서 검사하고 기록 수정 화면으로 연결
- 건강검진 결과의 수정 필요/검토 권장/보강 제안 분리, 필터, 대규모 결과 점진 표시와 아카이브 스코프 전환 시 재검사
- 작품 유형으로 확정 가능한 누락 진행 단위의 명시적 안전 수정, sync queue 출처 기록, 로컬 백업 메타데이터 기반 최근 수정 이력과 이후 값 미변경 시 되돌리기
- 자동 판단할 수 없는 건강검진 날짜·상태 문제를 탭 범위 24시간 세션으로 묶어
  기록별 문제 요약과 진행률을 표시하고, 저장 시 다음 기록으로 이동한 뒤 마지막
  기록에서 Settings로 복귀해 최신 로컬 원본을 다시 검사하는 연속 검토 흐름
- 개인 기록 기반 Insights 기본 집계와 개인 태그 상위 집계
- 계정 설정의 Aladin 키 저장/삭제
- `/imports/providers` 기반 provider readiness 조회와 Settings의 ready / user key required / server setup required / paused 상태 요약 UI/테스트
- Settings 계정 백업 섹션의 pending / failed / conflict queue item 표시, 상태별 설명, 원인별 복구 그룹, 기록 보기, 재시도 CTA
- failed sync item의 인증/네트워크/conflict/server validation/server error 원인 분류
- Sync conflict 원격 스냅샷 보존과 로컬 유지 / 원격 적용 / 필드별 병합 기본 해결 UX
- Sync safe auto-merge: work taxonomy(`genres`, `personalTags`), contributor/series aliases, release/timeline/graph/tier-board server metadata refresh를 동일 entity/parent와 동일 scalar 조건에서만 병합하고 재시도 queue로 되돌림
- Sync conflict 실행 전 로컬/원격 덮어쓰기 범위, 선택 필드 그룹, 삭제 상태
  주의 문구를 보여주는 수동 검토 요약
- auto sync push의 conflict queue item 자동 전송 제외
- account archive activation pull의 기존 queue push 선행
- push 실행 중 추가 queue 요청의 coalesced drain
- 숨김/offline 중 보류된 push의 focus/online/visible 전환 재개
- 다중 탭 sync lease busy의 retry-after 결과와 자동 pull/push 재예약
- 수동 sync의 lease busy 거짓 성공 방지
- guest local-first write의 자동 pull/push 제외
- `CatalogTitle` related read model과 `UserReleaseRecord` 흐름
- 홈 허브 화면
- 계정 센터 라우트 분리
- backend sync create의 `catalogTitleId -> importDraft -> legacy fallback` 처리 순서
- `importDraft.catalogTitle` optional legacy-compatible field와 누락 시 `payload.title` fallback
- Quick Add 검색 ranking의 제목 exact/alias/token, 제작자, 발매연도, provider/source coverage, catalog match 반영
- Quick Add 낮은 신뢰도 후보의 직접 추가 fallback 검토 안내
- Import/search QA report의 live-smoke manifest: smoke case/provider ID, credential mode, manual fallback case, credential-free provider-quality media type 명시
- Production migration job과 retention cleanup command
- Backup/restore drill 문서와 PostgreSQL backup vs IndexedDB JSON export/import
  역할 분리 문서

### Not Yet Implemented

- credentialed provider와 beta/staging 환경의 live 검색어 QA, 실제로 재현되는
  오순위에 대한 추가 ranking weight/정규화 튜닝. 로컬 credential-free
  provider 실검색은 2026-08-04에 수행했고 재현 가능한 오순위가 없어 점수를
  추측으로 변경하지 않았다.
- Sync conflict overlapping scalar 자동 병합, base snapshot 기반 병합, 고급 다기기 충돌 정책
- guest 기록 자동 병합 정책과 다기기 이관 UX
- 자동 동기화의 실제 계정/브라우저, 다중 탭 lease, 대용량 queue 운영 증적.
  account activation pull 직렬화, in-flight push drain, 숨김/offline 재개,
  lease busy retry-after 재예약은 로컬 회귀 테스트로 고정돼 있다.
- 공개 프로필 / 공개 기록 / 작품 집계
- 실제 티어 보드 기능 고도화
- Community production host, migrated runtime e2e, moderation operator, retention/takedown/rollback 증적
- Provider cache/circuit state의 Redis 경로 운영 증적과 다중 인스턴스 검증. 현재 코드는 `REDIS_URL` 구성 시 Redis를 사용하고, Redis가 없는 비프로덕션 환경에서는 process-local memory로 fallback한다.

### 확인한 것

- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `compose.prod.yml` 기준으로
  runtime non-root, API migration 분리, read-only/tmpfs/resource limit 정책을
  반영했다.
- Prisma schema 기준 장기 누적 대상은 `SecurityEvent`,
  `UserRefreshSession`, `UserSyncAppliedMutation`이다. (`PasswordResetToken`
  retention 타깃은 모델 제거와 함께 삭제됨)
- Import provider 코드 기준 KOBIS가 HTTP endpoint와 query `key`를 사용한다.
- Provider failure isolation은 `REDIS_URL` 구성 시 Redis-backed provider
  cache/circuit state로 동작한다. Redis가 없는 비프로덕션 환경에서는
  process-local memory fallback을 사용한다.

### 미확인 / 운영환경 의존

- 실제 production host의 Docker engine, kernel cgroup limit 적용 방식, reverse
  proxy/TLS termination, outbound egress path는 이 저장소만으로 검증할 수
  없다.
- KOBIS HTTP endpoint의 provider-side HTTPS 지원 여부와 약관/네트워크 허용
  범위는 배포 시점 운영자가 재확인해야 한다.
- Backup off-site 저장소, 암호화 키 보관, restore target 용량은 운영
  인프라 선택에 의존한다.

## 6. Validation Surface

### Root Scripts

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run qa:web-bundle-budget`
- `npm run qa:web-bundle-budget:self-test`

### Frontend Scripts

- `npm run dev --workspace @work-archive/web`
- `npm run build --workspace @work-archive/web`
- `npm run typecheck --workspace @work-archive/web`
- `npm run test --workspace @work-archive/web`

대표 테스트 표면:

- `src/app/App.test.tsx`
- `src/features/auth/pages/AuthFlow.test.tsx`
- `src/features/profile/pages/SettingsPage.test.tsx`
- `src/features/sync/services/sync.service.test.ts`
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

`test/works.e2e-spec.ts` is the fast API mock contract suite. It covers auth/session, works, sync, and provider credential flows without PostgreSQL. Real database coverage remains in `npm run test:integration`.

### Current Verification Status

- `npm run check:docs-links`: `2026-08-04` 문서 링크 갱신 후 통과 확인
- `npm run lint`: `2026-08-04` 통과 확인
- `npm run typecheck`: `2026-08-04` 통과 확인
- `npm run test`: `2026-08-04` 기준 API `92` suites / `770` tests,
  web `75` files / `489` tests, shared-types `2` files / `6` tests 통과 확인
- `npm run build`: `2026-08-04` 기준 shared-types `tsc`, API `tsc`, web Vite production build 통과 확인
- `npm run qa:web-bundle-budget:self-test`: `2026-08-04` 정상·상한 일치·상한
  초과·빈 산출물·잘못된 예산 fixture 통과 확인
- web route build는 auth/profile/insights 페이지를 각각의 실제 동적 import로
  분리한다. 기존 `auth` 671,959바이트 청크를 제거했고, 현재 최대 JavaScript
  청크는 568,218바이트로 650,000바이트 강제 상한을 통과한다.
- `npm run test:e2e:web`: `2026-08-04` 기준 `WEB_E2E_PORT=19999`로
  chromium/mobile-chrome Playwright `23` passed / `3` skipped 확인. mobile Add
  Work footer overlap, mobile drawer navigation, 320px overflow, Settings
  provider readiness, Quick Add source coverage 표시, 검색 실패 직접 추가
  fallback 회귀를 포함한다. API가 같이 뜨지 않은 로컬 Vite 단독 실행에서는
  `/api/auth/refresh` proxy `ECONNREFUSED` 경고가 예상되며 테스트는 guest
  fallback 경로로 통과한다. stale dev server가 기본 포트에 남아 있을 때는
  `WEB_E2E_PORT=<free-port> npm run test:e2e:web`로 fresh Vite 서버를 띄울 수
  있다.
- Tier Board private-first UI visual check: `2026-07-03` 기준 임시 Playwright
  chromium 검증으로 설정 모달이 `보관 상태`, `비공개`, `로컬 내보냄`을 표시하고
  raw `private` enum과 `링크 공유` 선택지를 노출하지 않음을 확인했다. 스크린샷은
  `output/playwright/tier-board-private-state.png`에 남겼고, 이 경로는 추적하지
  않는다.
- `npm run qa:import-search`: `2026-08-04` 기준 offline static fixtures,
  canonical matrix `28` cases, live smoke `6` cases / credential-free
  provider-quality media types `3`, live-smoke manifest, matrix shape,
  runbook linkage 통과 확인
- `npm run qa:sync-load`: `2026-07-01` 기준 dry-run synthetic payload
- `IMPORT_SEARCH_QA_LIVE=true IMPORT_QA_BASE_URL=http://127.0.0.1:18730 npm run
qa:import-search`: `2026-08-04` 로컬 개발 Compose에서 fallback safety `1/1`,
  credential-free provider-quality 매체 `4`종, smoke case `6`개 통과. Google
  Books 실패와 circuit open 중에도 Open Library/Wikidata/AniList 결과와 직접
  추가 fallback이 유지됐다. 이 로컬 무인증 결과는 beta/staging 인증 QA를
  대신하지 않는다.
  `1000` records / batch size `200` validation 통과 확인
- `npm run qa:docker-runtime:self-test`: `2026-07-01` 기준 fake Docker CLI로
  config-only PASS, build-mode PASS, Docker version failure BLOCKED, invalid
  boolean failure, report redaction behavior 통과 확인
- 로컬 개발 Docker Compose는 `2026-08-04` web/API/PostgreSQL healthy 상태와
  API `/readyz` 200을 확인했다. 이는 개발 번들/런타임 증적이며 `.env.prod`,
  production compose, release runner 증적은 아니다.
- `npm run qa:docker-runtime`의 과거 `2026-07-01` release preflight report는
  WSL socket/vsock 오류로 `BLOCKED`였다. 로컬 개발 Compose가 실행됐더라도
  `DOCKER_RUNTIME_BUILD=true` production release-runner 증적은 별도로 남아 있다.
- GitHub Actions `validate` workflow는 PR/push에서 lint/typecheck/test/build를 실행하도록 `.github/workflows/validate.yml`에 존재한다. Required checks 적용은 GitHub repository setting에서 관리한다.
- `docker compose --env-file .env.compose up --build -d`: `2026-08-04` 로컬
  개발 web/API/PostgreSQL 실행 및 health 확인. production compose는 미검증이다.

## 7. Immediate Limitations

### 7-1. Frontend

- Mantine foundation은 도입됐지만 스타일 책임은 아직 `global.css`와 페이지별 클래스 조합에 크게 남아 있다.
- shared UI primitives가 생기고 있지만 `var(--accent)`류 직접 참조와 커스텀 클래스 조합 의존이 여전히 크다.
- 과거 placeholder 성격이던 Tier Boards는 독립 보드 기능으로 구현됐고, Community는 명시적 공개 입력을 사용하는 알파 화면으로 구현됐다. 남은 프론트 부채는 스타일 책임과 실런타임 QA 증적 고도화 쪽에 가깝다.
- 직접 수동 추가, `/works` AddWorkDialog, `/works/new` fallback, guest no-key
  provider 검색, ranking/search quality 기본 구현/테스트와 로컬
  credential-free Chrome QA는 완료했다. 남은 일은 credentialed beta/staging
  검색과 운영 브라우저 증적 고도화다.
- Quick Add provider readiness UI, Settings provider readiness/data-safety/account-backup summary, duplicate policy, SearchPickerPanel 기반 inline 검색 흐름의 기본 구현/테스트는 들어갔다.
- Quick Add 저장은 현재 제품 기준에서 의도적으로 local-first sync 경로를 유지한다. authenticated direct create path는 기본 생성 경로가 아니다.

### 7-2. Product UX

Sync UX reality: sync is not manual-only anymore. The Settings account backup
section is the explicit user-facing control surface, while authenticated users
also get serialized pull-before-push, coalesced push drain, and availability-based resume from `useAutoSync`. Narrow safe auto-merge can requeue safe taxonomy/alias/metadata-only cases; unsafe conflict items are resolved from Settings.

- 게스트와 계정 아카이브는 분리되어 있고, 현재는 로그인 직후 review/import 단계까지만 제공된다.
- sync는 Settings 계정 백업 섹션을 기본 조작면으로 제공하고, 로그인 상태에서는
  account activation pull 선행, push drain, 숨김/offline 후 재개가 보장된
  자동 pull/push도 수행한다.
- Settings 계정 백업 섹션은 pending / failed / conflict queue item 단위 상태와 원인별 복구 그룹, 기록 보기, 재시도 CTA를 제공한다.
  다른 탭이 lease를 보유한 경우에는 성공으로 오인하지 않고 지연 후 자동
  재시도한다.
- Settings 계정 백업 섹션은 conflict 항목에서 원격 스냅샷을 비교하고 로컬 유지,
  원격 적용, 필드별 병합으로 해결할 수 있다. 실행 전 덮어쓰기 범위와 선택한
  필드 그룹을 요약하고 삭제 상태가 포함되면 주의 문구를 표시한다. 좁은 safe
  auto-merge는 자동 처리되지만, overlapping scalar 편집과 delete/update
  collision은 후속 수동 검토로 남긴다.
- auto sync push는 conflict queue item을 자동 전송하지 않고 수동 검토 대상으로 남긴다.
- guest local-first write는 자동 pull/push를 시작하지 않고 로그인 archive와 분리된다.
- Profile과 Insights는 개인 기록 요약/통계로 제한한다. Tier Boards는 독립 기능으로 유지한다. Community는 개인 아카이브와 분리된 공개 읽기·로그인 쓰기 알파로 노출한다.

### 7-3. Backend / Security

- `WorksModule`은 현재 호환성 계층이라서, 내부 split domain과 외부 flat 계약이 함께 유지되고 있다.
- 현재 catalog는 shared public catalog라기보다 user record와 강하게 결합된 `1:1` 과도기 구조다.
- sync create path는 `catalogTitleId -> importDraft -> legacy fallback` 순서로 테스트 고정돼 있다. `importDraft.catalogTitle`은 optional legacy-compatible field이며, 없으면 `payload.title`로 fallback한다.
- 장기적으로 sync create와 Quick Add import 흐름은 `Works` compatibility layer에서 더 멀어져야 한다.
- access token은 memory-first로 관리되며 브라우저 `localStorage`/`sessionStorage`에 지속 저장하지 않는다.
- Community 저장소 구현은 존재하지만 production 노출 승인은 별도 Gate 증적 전까지 보류다. Tier Board의 link_only enum은 future-reserved 상태로 유지하고 사용자 설정 UI에 노출하지 않는다. 남은 운영 과제는 Community host/migration/moderation/retention/takedown/rollback 증적, 세션/디바이스 관리 고도화, production cookie/origin/secret 운영 검증이다.

## 8. Where To Read Next

- 현재 구조 기준: [`../architecture/FEATURE_FIRST_STRUCTURE.md`](../architecture/FEATURE_FIRST_STRUCTURE.md)
- 프론트 reference: [`../archive/frontend/FRONTEND_BLUEPRINT_V1.md`](../archive/frontend/FRONTEND_BLUEPRINT_V1.md)
- 프론트 구조 reference: [`../archive/frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../archive/frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
- 제품 reference: [`../archive/product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../archive/product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- 백엔드 reference: [`../archive/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../archive/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 공개 준비: [`../security/PUBLIC_REPOSITORY_READINESS.md`](../security/PUBLIC_REPOSITORY_READINESS.md)
