# WorkArchive Current Execution Plan

| Field                 | Value                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `active`                                                                                                                                       |
| Role                  | `developer execution entrypoint`                                                                                                               |
| Source of truth       | `README.md`, `docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`, `docs/project/EXECUTION_ROADMAP.md`, `docs/project/ROADMAP_FEEDBACK_2026-06.md`, current local `master` working tree |
| Last verified against | `2026-06-12` documentation alignment plus root `check:docs-links`, `lint`, and `typecheck`, with API/shared tests after API service decomposition, including sync, import resolve, internal catalog import candidate, import search stage cache, import provider readiness, import candidate decoration, import provider search runner, import provider credential runtime, import provider search stage, import search observability, import provider key management, import search context/result extraction, Bearer access token parsing extraction, auth session metadata extraction, auth response mapper extraction, Google OAuth controller helper extraction, image proxy policy/cache helper extraction, user records helper/progress/release payload builder extraction, catalog legacy work helper extraction, catalog ingestion normalization/payload extraction, catalog title matching/submission helper extraction, and Notion sync mapper extraction. Root `npm run test` is currently blocked by dirty frontend `WorksListPage.test.tsx` failures; build, import-search QA, sync-load dry-run, and web E2E remain last verified on `2026-06-04` |
| When to update        | 코드 현실, 실행 명령, 문서 기준점, 검증 정책, near-term 작업 순서가 바뀔 때                                                                    |

이 문서는 현재 작업자가 바로 개발을 이어가기 위한 실행 기준이다. 과거 milestone 문맥은 [`../archive/project/PLAN.md`](../archive/project/PLAN.md)에 보존돼 있지만, 현재 작업 기준으로 사용하지 않는다.

## Read First

1. [`README.md`](../../README.md): 실행 명령, 환경 변수, 검증 상태
2. [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md): 현재 코드 현실
3. [`EXECUTION_ROADMAP.md`](./EXECUTION_ROADMAP.md): 통합 실행 순서
4. [`ROADMAP_FEEDBACK_2026-06.md`](./ROADMAP_FEEDBACK_2026-06.md): 구조적 부채 상환과 확장 대비 보조 로드맵
5. 작업 영역별 문서:
   - Frontend archive: [`docs/archive/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../archive/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
   - Backend archive: [`docs/archive/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../archive/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

## Workspace Setup

```bash
npm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev:db
npm run db:migrate:deploy
npm run dev
```

기본 엔드포인트:

- Web: http://localhost:18730
- API health: http://localhost:18731/health
- Swagger: http://localhost:18731/docs

Docker Compose는 설정 파일이 있지만, 이 문서 기준 최신 세션에서 실제 실행 검증하지 않았다. 실행하지 않은 Compose 검증은 통과로 기록하지 않는다.

## Current Architecture Facts

- Frontend는 `apps/web`, API는 `apps/api`, 공유 타입은 `packages/shared-types`에 있다.
- 프론트 저장은 IndexedDB/Dexie local-first가 기본이다.
- authenticated Quick Add도 direct create가 아니라 `Dexie -> syncQueue -> sync push` 경로를 탄다.
- Quick Add matched external candidate는 `catalogTitleId`를 저장하고 `importDraft`는 `null`로 둔다.
- Quick Add unmatched external candidate는 identity-only `importDraft`를 저장하며 `title`, `author`, `description`, `thumbnailUrl`, `genres`를 중복 저장하지 않는다.
- Quick Add `manual` / `preview-manual` 후보는 catalog/import identity 없이 local draft로 저장한다.
- duplicate detection은 `catalogTitleId -> externalRefs -> title fallback` 순서다.
- backend sync create는 `catalogTitleId -> importDraft -> legacy fallback` 순서다.
- `importDraft.catalogTitle`은 optional legacy-compatible field이며, 없으면 `payload.title`로 fallback한다.
- Settings provider readiness 기본 UI와 테스트는 들어갔다.
- SyncPage는 pending / failed / conflict queue item 상태, 원인, 기록 보기, 재시도 CTA와 conflict 기본 해결 UX를 제공한다.
- Sync conflict 해결은 로컬 유지, 원격 적용, 필드별 병합을 지원한다. 자동 병합 판단은 현재 제품 기준에서 채택하지 않는다.
- Works 목록 조회는 Dexie v7 scope index로 active/trash를 먼저 좁힌다. status/type/updatedAt 기본 경로는 IndexedDB query를 먼저 사용하고, 검색어/태그 조합은 scope 축소 후 인메모리 필터링한다.
- manual timeline entries는 Dexie v9 sync-ready 모델과 backend `UserTimelineEntry` private storage를 통해 optional account sync 대상에 포함된다.
- JSON export는 schemaVersion, source, backupExclusions metadata와 timeline entries를 포함한다. import preview는 dry-run 결과로 add/update/duplicate/skip/conflict 예상치를 표시한다.
- Quick Add 검색 ranking은 제목 exact/alias/token, 제작자, 발매연도, provider/source coverage, catalog match를 반영한다.
- 낮은 신뢰도 검색 후보는 직접 추가 fallback을 방해하지 않도록 후보 UI에서 검토 안내를 표시한다.
- access token은 브라우저 storage에 저장하지 않고 메모리에만 둔다. 앱 부팅은 `HttpOnly` refresh cookie로 세션을 복구하며, 실패하면 guest archive로 돌아간다.
- GitHub Actions `validate` workflow는 이미 존재한다. 이 문서 기준 required checks는 repository setting에서 별도 관리한다.
- Provider cache/circuit state는 `REDIS_URL`이 구성되면 Redis를 사용한다. Redis가 없는 비프로덕션 환경에서는 process-local memory fallback을 사용한다.
- API sync orchestration은 push/pull service에서 page loading, payload mapping, change building, entity handler, validation/result helper로 분해되어 있다. 외부 sync API 계약은 그대로 유지한다.
- import 후보 resolve payload 정규화는 `ImportsService` 내부 helper가 아니라 `resolve-import-candidate` 순수 함수가 담당한다.
- 내부 catalog 후보 검색과 import candidate 변환은 `internal-catalog-import-candidates`가 담당한다.
- import 검색 단계 캐시 key 생성, 캐시 가능성 판정, cached payload guard는 `import-search-stage-cache`가 담당한다.
- import provider readiness/status 계산은 `import-provider-readiness`가 담당한다.
- import 후보의 catalog match와 기존 user record 보강은 `import-candidate-decoration`이 담당한다.
- provider별 검색 실행, skip/failure diagnostic, circuit side effect는 `import-provider-search-runner`가 담당한다.
- stored/server provider credential lookup과 provider search runtime 구성은 `import-provider-credential-runtime`이 담당한다.
- provider search stage의 cache read/write와 provider별 runner 병렬 실행은 `import-provider-search-stage`가 담당한다.
- provider 결과 diagnostics/summary/metric 조립은 `import-search-observability`가 담당한다.
- provider key 저장/삭제/연결 테스트는 `import-provider-key-management`가 담당한다.
- 검색 request context 확정은 `import-search-context`, 검색 후보 merge/ranking과 response assembly는 `import-search-result`가 담당한다.
- Bearer access token header 파싱은 `auth/bearer-token` helper가 담당하며, required guard 경로와 optional-auth import 검색 경로가 같은 규칙을 공유한다.
- refresh session user agent 요약과 IP address 마스킹은 `auth-session-metadata` helper가 담당한다.
- auth user response, Google auth account persistence payload, refresh session response mapping은 `auth-response-mappers` helper가 담당한다.
- Google OAuth return origin allowlist, redirect URL, OAuth flow cookie options, request session metadata, stored flow consume/state verification은 `auth-google-oauth` helper가 담당한다.
- image proxy URL allowlist, redirect/content-type/body size policy, cache entry/Redis key serialization, proxied response mapping은 `image-proxy-policy` helper가 담당한다.
- user records의 DTO date parsing, record medium/policy view, grouped key 산출, update/create/import/progress/release payload builder는 `user-records.helpers`가 담당한다.
- legacy `CatalogWork` genre 정규화와 legacy work 기반 `CatalogTitle` upsert payload 조립은 `catalog-legacy-work` helper가 담당한다.
- import candidate 기반 catalog ingestion의 external ref/release candidate 정규화와 release identity 판정은 `catalog-ingestion-normalization` helper가 담당한다.
- import candidate 기반 catalog ingestion의 title/release update payload와 match view 변환은 `catalog-ingestion-payloads` helper가 담당한다.
- import candidate 기반 catalog title matching의 문자열 정규화, title/contributor/year scoring은 `catalog-title-matching` helper가 담당한다.
- catalog submission 생성 payload, list query args, moderation access guard, pending review guard는 `catalog-submissions` helper가 담당한다.
- Notion sync의 schema/property mapping, Notion page safe value read, diff, pull update payload 조립은 `notion-sync-mappers` helper가 담당한다.

## Current Follow-Up Work

- provider별 실제 검색어 QA와 ranking weight 튜닝
- Settings provider readiness polish
- Sync conflict 고급 자동 병합 정책 검토
- 로그인 직후 pull 자동화 검토
- `Works` compatibility layer 축소와 `Catalog` / `Imports` / `UserRecords` 경계 정리
- 공개 레이어 권한 분리와 production cookie/origin/secret 운영 검증
- provider runtime Redis 경로의 beta/production 운영 증적 확보

## 2026-06-04 Expert Feedback Implementation

첨부 전문가 피드백은 아래처럼 현재 제품 방향에 맞춰 수용한다.

- 수용: 검색 품질 QA, sync 신뢰성 검증, API 도메인 경계 정리, Gate 1 운영
  증적 보강.
- 정정: 라이선스는 누락이 아니라 README 기준 all-rights-reserved 정책이다.
- 정정: CI/E2E는 부재가 아니라 web Playwright E2E의 validate 포함 여부가
  아직 별도 안정화 과제다.
- 제외: public/community/social/recommendation, mobile, Tauri, i18n은 현재
  실행계획 범위 밖이다.

구현 기준:

- 검색 품질은 `docs/qa/IMPORT_SEARCH_QA_CASES.json`을 golden matrix로 삼고,
  provider QA 케이스와 ranking 회귀 테스트를 먼저 늘린다.
- sync는 새 자동 병합 규칙보다 `SYNC_AUTO_MERGE_POLICY.md`의 좁은 정책,
  stale pull-before-push, manual conflict resolution, sync load smoke를 먼저
  고정한다.
- API 개선은 flat `Works` 응답을 즉시 제거하지 않는다. 신규 기능은 가능한
  한 `Catalog`, `Imports`, `UserRecords`, `Sync` 경계에 두고, `Works`는
  compatibility façade로만 유지한다.
- Gate 1은 로컬 저장소 파일만으로 증명 가능한 항목과 GitHub Settings,
  beta host, restore drill처럼 운영자가 직접 증적을 남겨야 하는 항목을
  분리한다.

## Documentation Sync Checklist

문서를 수정할 때는 아래 stale 의미가 다시 들어가지 않게 한다.

- provider readiness UI와 duplicate policy를 미완성 상태로 설명하지 않는다.
- authenticated direct create path를 미구현 또는 정리 중인 기본 경로로 설명하지 않는다.
- SyncPage conflict 상세 진입점을 전면 미구현 상태로 설명하지 않는다.
- Quick Add를 preview-only 흐름으로 설명하지 않는다.

대신 아래 기준으로 쓴다.

- provider readiness, duplicate detection, ranking/search quality의 기본 구현/테스트는 완료, 실제 검색어 QA와 polish는 후속
- authenticated direct create path는 현재 제품 기준에서 의도적으로 채택하지 않는 경로
- SyncPage queue item 단위 상태/원인/기록 보기/재시도 CTA와 기본 conflict 해결 UX는 구현
- Docker Compose는 실제 실행하지 않았다면 미검증

## Validation Policy

- 문서만 수정하면 npm 테스트 실행은 선택이다.
- 문서 수정 후 stale 표현은 `rg`로 확인한다.
- 코드, 타입, 설정, 테스트 파일이 의도치 않게 바뀌면 범위를 멈추고 분리한다.
- 코드 변경이 포함된 작업은 최소 `npm run typecheck`와 관련 테스트를 실행한다.
- 실행하지 않은 검증 명령은 문서에 새 통과 기록으로 남기지 않는다.
