# WorkArchive Current Execution Plan

| Field                 | Value                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `active`                                                                                                                                       |
| Role                  | `developer execution entrypoint`                                                                                                               |
| Source of truth       | `README.md`, `docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`, `docs/project/EXECUTION_ROADMAP.md`, current local `master` working tree |
| Last verified against | `2026-04-25` local `master` working tree                                                                                                       |
| When to update        | 코드 현실, 실행 명령, 문서 기준점, 검증 정책, near-term 작업 순서가 바뀔 때                                                                    |

이 문서는 현재 작업자가 바로 개발을 이어가기 위한 실행 기준이다. 과거 milestone 문맥은 [`docs/project/PLAN.md`](./docs/project/PLAN.md)에 보존돼 있지만, 현재 작업 기준으로 사용하지 않는다.

## Read First

1. [`README.md`](./README.md): 실행 명령, 환경 변수, 검증 상태
2. [`docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md): 현재 코드 현실
3. [`docs/project/EXECUTION_ROADMAP.md`](./docs/project/EXECUTION_ROADMAP.md): 통합 실행 순서
4. 작업 영역별 문서:
   - Frontend: [`docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
   - Backend: [`docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](./docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

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

- Web: http://localhost:5173
- API health: http://localhost:3000/health
- Swagger: http://localhost:3000/docs

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
- Quick Add 검색 ranking은 제목 exact/alias/token, 제작자, 발매연도, provider/source coverage, catalog match를 반영한다.
- 낮은 신뢰도 검색 후보는 직접 추가 fallback을 방해하지 않도록 후보 UI에서 검토 안내를 표시한다.

## Current Follow-Up Work

- provider별 실제 검색어 QA와 ranking weight 튜닝
- Settings provider readiness polish
- Sync conflict 해결 UX polish와 고급 자동 병합 정책 검토
- 로그인 직후 pull 자동화 검토
- `Works` compatibility layer 축소와 `Catalog` / `Imports` / `UserRecords` 경계 정리
- access token 저장 구조와 공개 레이어 권한 분리

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
