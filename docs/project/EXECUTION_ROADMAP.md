# EXECUTION_ROADMAP.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `integrated execution roadmap` |
| Source of truth | [`PRODUCT_DIRECTION_LOCK.md`](../product/PRODUCT_DIRECTION_LOCK.md), [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), current `apps/web` / `apps/api` implementation, `README.md` verification commands |
| Last verified against | `2026-04-25` user direction review |
| When to update | near-term execution order, phase boundaries, guest/login policy, frontend design workflow rule, or verification gates change |

이 문서는 Work Archive의 **단일 통합 실행 로드맵**이다. current reality 문서를 대체하지 않고, 지금 무엇을 어떤 순서로 고정해야 하는지만 정리한다.

## Summary

- 제품 본질은 **개인 local-first 작품 기록/리뷰 아카이브**다.
- 로그인은 선택이다. 꼭 계정이 필요한 기능이 아니라면 guest도 사용할 수 있어야 한다.
- 현재 제품 기준은 `direct manual add + optional-auth server-assisted search + local-first save`다.
- Manual Add, guest no-key provider search, Quick Add identity 저장, duplicate detection, backend sync create 순서는 테스트로 고정돼 있다.
- 수정된 우선순위는 `문서 정합성 -> manual add/guest search 테스트 고정 -> Quick Add UX -> WorksList/Review UX -> Sync resolution -> security/deploy -> minimal Insights`다.
- `Tier Boards`, `Community`는 개인 아카이브가 안정화된 뒤로 미룬다.

## Product Direction Lock

우선 읽을 기준 문서:

- [`../product/PRODUCT_DIRECTION_LOCK.md`](../product/PRODUCT_DIRECTION_LOCK.md)

핵심 원칙:

```text
Work Archive의 본질은 개인 local-first 작품 기록/리뷰 아카이브다.
서버 검색과 catalog identity는 보조 기능이며,
public/community/catalog promotion은 private sync path와 섞지 않는다.
```

구현 판단 원칙:

- 수동 추가는 핵심 기능이다.
- 로그인은 선택이다.
- 로그인하지 않아도 작품 기록 앱으로 쓸 수 있어야 한다.
- key가 필요 없는 검색 provider는 guest에게도 제공하는 방향으로 구현한다.
- 개인 기록 데이터와 서버/catalog/community 데이터는 별도 plane이다.
- 커뮤니티는 미래 확장이다.

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

- README, canonical docs, env examples, verification 기록을 실제 코드와 제품 본질 기준으로 다시 고정한다.

현재 기준:

- 외부 provider 검색은 이미 구현돼 있다.
- `/imports/providers`와 `/imports/search`는 optional Authorization 기반으로 동작한다.
- frontend imports service는 토큰이 있으면 authenticated request, 없으면 plain request를 보낸다.
- guest는 key가 필요 없는 provider 검색과 manual provider를 사용할 수 있고, user/server credential provider는 정책에 따라 제한된다.
- Dexie 테이블은 `works`, `releaseRecords`, `syncQueue`, `appMeta`다.
- Prisma 표면은 `CatalogWork`, `CatalogTitle`, `CatalogRelease`, `CatalogExternalRef`, `UserWorkRecord`, `UserReleaseRecord`까지 이미 확장돼 있다.
- `Works`는 compatibility layer고, `user-records/from-import`는 준비돼 있지만 현재 기본 생성 경로는 아니다.

완료 기준:

- 루트 README와 current-reality 문서가 같은 제품 현실을 설명한다.
- 제품 본질이 개인 작품 기록/리뷰 아카이브로 명시된다.
- guest/login 차별 금지 원칙이 문서에 반영된다.
- Quick Add 저장 흐름이 현재 local-first sync 규칙과 일치한다.
- 검증 결과가 문서에 남아 있다.

## Track 2. Manual Add Baseline

목표:

- 검색 없이 직접 작품을 추가할 수 있는 수동 추가 경로를 제품 기본 경로로 고정한다.

왜 먼저 하는가:

- 이 웹사이트의 1순위 용도는 내가 본 작품을 정리하고 리뷰를 남기는 것이다.
- 검색 provider가 없거나 틀리거나 로그인하지 않은 상황에서도 사용자는 기록을 남길 수 있어야 한다.
- 수동 추가는 fallback이 아니라 핵심 기능이다.

현재 기준:

- `QuickAddWorkForm`은 `manual` / `search` AddMode를 가진다.
- `/works/new`의 기본 흐름은 `직접 추가`다.
- 수동 저장은 `catalogTitleId: null`, `importDraft: null`로 local-first 저장된다.
- guest와 logged-in user 모두 사용할 수 있다.

남은 방향:

- 수동 추가 UX를 더 명확하게 polish한다.
- `QuickAddWorkForm`이 커지고 있으므로 UI polish 과정에서 작은 컴포넌트로 점진 분리한다.
- authenticated 상태에서도 direct server create가 아니라 기존 `Dexie -> syncQueue` 경로를 유지한다.

완료 기준:

- 검색 없이 제목을 입력해 저장할 수 있다.
- guest에서도 동작한다.
- 수동 추가된 기록은 local-first로 저장된다.
- 기존 Quick Add matched/unmatched/manual identity 테스트가 깨지지 않는다.

## Track 3. Guest Search Parity

목표:

- 로그인하지 않아도 key가 필요 없는 검색 provider를 계속 사용할 수 있게 테스트와 정책을 고정한다.

왜 하는가:

- 로그인은 선택이다.
- 꼭 계정이 필요한 기능이 아니라면 guest에게도 제공해야 한다.
- 검색은 작품 추가의 편의 기능이지 계정 기능이 아니다.

현재 기준:

- backend `/imports/providers`와 `/imports/search`는 optional Authorization 기반이다.
- malformed Authorization은 401로 거절한다.
- frontend `importsService.searchCandidates`는 토큰이 없으면 plain request를 보내고, 토큰이 있으면 authenticated request를 보낸다.
- guest는 no-user-key provider와 `manual` provider를 사용할 수 있다.

남은 방향:

- provider credential mode 정책을 테스트로 계속 고정한다.
- `server` provider는 비용/쿼터/rate limit 정책에 따라 guest 제공을 별도로 검토한다.
- `user` provider, 예: Aladin user TTBKey 저장/사용은 로그인 필요로 유지한다.
- guest external search에는 rate limit을 적용한다.
- provider readiness UI는 guest에게도 “바로 사용 가능 / 로그인 필요 / 서버 설정 필요”를 설명한다.

예상 no-user-key provider:

- AniList
- Google Books
- Open Library
- TVmaze
- manual

완료 기준:

- guest도 no-user-key provider 검색을 사용할 수 있다.
- user-scoped provider는 로그인 필요 안내가 나온다.
- 검색 실패 시 수동 추가로 자연스럽게 이동할 수 있다.
- 기존 authenticated provider tests가 깨지지 않는다.

## Track 4. Quick Add Trust And UX

목표:

- 검색 결과가 local-first 저장 경로 안에서도 catalog identity를 잃지 않게 하고, 입력 흐름을 더 명확하게 만든다.

현재 테스트로 고정된 규칙:

- `catalogMatch.id`가 있으면 local record에 `catalogTitleId`를 저장한다.
- external provider 결과이지만 `catalogMatch.id`가 없으면 local record에 identity-only `importDraft`를 저장한다.
- unmatched external candidate의 `importDraft`에는 `title`, `author`, `description`, `thumbnailUrl`, `genres`를 중복 저장하지 않는다.
- `preview-manual` 또는 `manual` 후보는 catalog/import identity 없이 현재 draft 저장 흐름을 유지한다.
- authenticated 저장 경로는 계속 `Dexie -> syncQueue`다.
- duplicate detection은 `catalogTitleId -> externalRefs -> title fallback` 우선순위로 동작한다.
- Settings provider readiness UI는 `/imports/providers` 기반 기본 구현/테스트가 들어갔다.

다음 단계:

- Quick Add candidate card / selected preview / status input / save CTA polish
- provider별 ranking/search quality 개선
- provider readiness UI polish
- duplicate warning UX polish

## Track 5. Catalog Boundary

목표:

- 새 도메인 지식은 `Catalog`, `Imports`, `UserRecords`에 쌓고 `Works`는 compatibility maintenance에 한정한다.

현재 테스트로 고정된 규칙:

- sync create는 `catalogTitleId` 우선, `importDraft` 차선, legacy draft fallback 마지막 순서로 처리한다.
- `importDraft.catalogTitle`은 optional legacy-compatible field이며, 없으면 `payload.title`로 fallback한다.
- `Works`와 `user-records/from-import`는 유지하되, 새 성장 경로는 `Works`에 누적하지 않는다.
- authenticated direct create path는 현재 제품 기준에서 채택하지 않는다. 기본 생성 경로는 local-first sync다.

방향:

- 개인 기록 데이터와 서버/catalog 데이터는 별도 plane으로 유지한다.
- sync는 개인 기록 정합성 문제다.
- catalog promotion은 별도 검수/공개 pipeline 문제다.

## Track 6. Sync And Product Clarity

목표:

- 사용자가 이해할 수 있는 동기화/계정 경험으로 정리한다.

현재 구현:

- SyncPage는 pending / failed / conflict queue item 단위 상태를 표시한다.
- queue item별 원인, 기록 보기, 재시도 CTA를 제공한다.

근거리 순서:

1. conflict overwrite/merge resolution 도입
2. 로그인 직후 pull 자동화 검토
3. sync 상태 polish와 실패 복구 UX 개선

## Track 7. Later Public / Community

목표:

- 개인 아카이브가 안정화된 뒤 공개/커뮤니티 기능을 별도 plane으로 검토한다.

원칙:

- 개인 기록은 기본 private다.
- 공개 여부는 사용자가 명시적으로 선택한다.
- public/community 기능은 private archive 저장 경로를 바꾸지 않는다.
- catalog promotion은 별도 submission/moderation pipeline을 사용한다.

후순위 항목:

- minimal Insights
- personal Tier Boards
- public profile
- public works
- community
- moderation

## Verification Gates

Phase 1+ 게이트:

- `npm run typecheck`
- `npm run test --workspace @work-archive/web`
- `npm run test --workspace @work-archive/api`
- `npm run build`
- `docker compose up --build`: 현재 문서 기준 미검증이면 미검증으로 유지한다.

문서에는 마지막 확인 날짜와 결과를 남긴다.
