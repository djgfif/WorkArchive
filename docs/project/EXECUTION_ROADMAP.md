# EXECUTION_ROADMAP.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `integrated execution roadmap` |
| Source of truth | [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), current `apps/web` / `apps/api` implementation, `README.md` verification commands |
| Last verified against | `2026-04-24` working tree |
| When to update | near-term execution order, phase boundaries, frontend design workflow rule, or verification gates change |

이 문서는 Work Archive의 **단일 통합 실행 로드맵**이다. current reality 문서를 대체하지 않고, 지금 무엇을 어떤 순서로 고정해야 하는지만 정리한다.

## Summary

- 현재 제품 기준은 `server-assisted search + local-first save`다.
- Quick Add 검색은 authenticated 상태에서 `/imports/search`를 사용하고, 저장은 계속 `Dexie -> syncQueue`를 기본으로 둔다.
- 현재 우선순위는 `Quick Add -> Catalog dedupe -> Works/Sync clarity -> security/deploy -> minimal Insights`다.
- `Tier Boards`, `Community`는 위 흐름이 안정화된 뒤로 미룬다.

## Frontend Design Workflow

프론트엔드 디자인, 화면 구조 탐색, 디자인 시스템 정의, 화면 시안, 스타일 가이드는 **`stich MCP 서버 (Stitch)`를 우선 사용한다.**  
코드 구현은 그 결과를 기준으로 저장소에서 이어간다.

예외:

- 기존 화면의 작은 CSS 수정
- 단순 spacing 조정
- 비주얼 탐색이 필요 없는 순수 로직 작업

위 작업은 `stich MCP 서버` 의무 대상이 아니다.

## Track 1. Truth Alignment

목표:

- README, canonical docs, env examples, verification 기록을 실제 코드 기준으로 다시 고정한다.

현재 기준:

- 외부 provider 검색은 이미 구현돼 있다.
- Dexie 테이블은 `works`, `releaseRecords`, `syncQueue`, `appMeta`다.
- Prisma 표면은 `CatalogWork`, `CatalogTitle`, `CatalogRelease`, `CatalogExternalRef`, `UserWorkRecord`, `UserReleaseRecord`까지 이미 확장돼 있다.
- `Works`는 compatibility layer고, `user-records/from-import`는 준비돼 있지만 현재 기본 생성 경로는 아니다.

완료 기준:

- 루트 README와 current-reality 문서가 같은 제품 현실을 설명한다.
- stale한 `Quick Add preview-only` 설명이 남아 있지 않다.
- `2026-04-24` 검증 결과가 문서에 남아 있다.

## Track 2. Quick Add Trust

목표:

- 검색 결과가 local-first 저장 경로 안에서도 catalog identity를 잃지 않게 만든다.

이번 패스에서 고정하는 규칙:

- `catalogMatch.id`가 있으면 local record에 `catalogTitleId`를 저장한다.
- external provider 결과이지만 `catalogMatch.id`가 없으면 local record에 `importDraft`를 저장한다.
- `preview-manual` 또는 `manual` 후보는 현재 draft 저장 흐름을 유지한다.
- authenticated 저장 경로는 계속 `Dexie -> syncQueue`다.

다음 단계:

- provider readiness UI를 `/imports/providers` 기반으로 확장한다.
- duplicate detection을 `catalogTitleId` / `externalRefs` 우선 비교로 올린다.

## Track 3. Catalog Boundary

목표:

- 새 도메인 지식은 `Catalog`, `Imports`, `UserRecords`에 쌓고 `Works`는 compatibility maintenance에 한정한다.

이번 패스에서 고정하는 규칙:

- sync create는 `catalogTitleId` 우선, `importDraft` 차선, legacy draft fallback 마지막 순서로 처리한다.
- `Works`와 `user-records/from-import`는 유지하되, 새 성장 경로는 `Works`에 누적하지 않는다.

## Track 4. Sync And Product Clarity

목표:

- 사용자가 이해할 수 있는 동기화/계정 경험으로 정리한다.

근거리 순서:

1. pending / failed / conflict 표시 강화
2. conflict detail 진입점 제공
3. conflict resolution 도입
4. 로그인 직후 pull 자동화 검토

## Verification Gates

`2026-04-24` 기준 Phase 1 게이트:

- `npm run typecheck`
- `npm run test --workspace @work-archive/web`
- `npm run test --workspace @work-archive/api`
- `npm run build`
- `docker compose up --build`

문서에는 마지막 확인 날짜와 결과를 남긴다.
