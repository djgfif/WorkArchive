# EXECUTION_ROADMAP.md

| Field                 | Value                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `active`                                                                                                                                                                                                                                                 |
| Role                  | `integrated execution roadmap`                                                                                                                                                                                                                           |
| Source of truth       | [`PRODUCT_DIRECTION_LOCK.md`](../archive/product/PRODUCT_DIRECTION_LOCK.md), [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), current `apps/web` / `apps/api` implementation, `README.md` verification commands |
| Last verified against | `2026-07-01` root `security:public`, `check:docs-links`, `lint`, `typecheck`, `test`, `build`, web feature boundary check, web import cycle check, web Playwright E2E after mobile Add Work footer overlap fix and mobile drawer navigation regression, Settings provider readiness polish, Quick Add source coverage/fallback regressions, auto-sync conflict queue safety regression, guest auto-sync boundary regression, offline import-search QA with live-smoke matrix contract/manifest, sync-load dry-run, Docker runtime preflight self-test, and Docker runtime preflight BLOCKED report. |
| When to update        | near-term execution order, phase boundaries, guest/login policy, frontend design workflow rule, or verification gates change                                                                                                                             |

이 문서는 Work Archive의 **통합 실행 로드맵**이다. current reality 문서를 대체하지 않고, 지금 무엇을 어떤 순서로 고정해야 하는지만 정리한다. 최신 구현 현실은 [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), 개발 진입점은 [`CURRENT_EXECUTION_PLAN.md`](./CURRENT_EXECUTION_PLAN.md), 2026-06 구조 부채 보조 로드맵은 [`ROADMAP_FEEDBACK_2026-06.md`](./ROADMAP_FEEDBACK_2026-06.md)를 따른다.

## Summary

- 제품 본질은 **순수 개인용 local-first 작품 기록/리뷰 아카이브**다.
- 로그인은 선택이다. 꼭 계정이 필요한 기능이 아니라면 guest도 사용할 수 있어야 한다.
- 공개 프로필, 공개 리뷰, 커뮤니티, 팔로우, 댓글, moderation은 현재 제품 범위 밖이다.
- 현재 제품 기준은 `direct manual add + optional-auth server-assisted search + local-first save`다.
- Manual Add, guest no-key provider search, Quick Add identity 저장, duplicate detection, backend sync create 순서는 테스트로 고정돼 있다.
- 검색은 diagnostics, normalization, merge/dedupe, ranking, sourceCoverage, manual fallback 분리, candidate trust 표시, live-smoke manifest까지 2차 고도화가 진행됐다. 남은 작업은 실제 provider별 검색어 QA와 튜닝이다.
- 수정된 우선순위는 `개인 기록 UX -> export/import -> 개인 기록 깊이 -> optional private sync -> search quality -> personal Insights`다.
- `Public`, `Community`, `Social`, `Catalog moderation` 계열 작업은 무기한 보류한다.

## Product Direction Lock

우선 읽을 기준 문서:

- [`../archive/product/PRODUCT_DIRECTION_LOCK.md`](../archive/product/PRODUCT_DIRECTION_LOCK.md)

핵심 원칙:

```text
Work Archive의 본질은 순수 개인용 local-first 작품 기록/리뷰 아카이브다.
서버 검색과 catalog identity는 입력 보조 기능이며,
public/community/catalog promotion은 현재 제품 범위 밖이다.
```

구현 판단 원칙:

- 수동 추가는 핵심 기능이다.
- 로그인은 선택이다.
- 로그인하지 않아도 작품 기록 앱으로 쓸 수 있어야 한다.
- key가 필요 없는 검색 provider는 guest에게도 제공하는 방향으로 구현한다.
- 개인 기록 데이터와 서버/catalog 보조 데이터는 별도 plane이다.
- 커뮤니티와 공개 기능은 현재 구현하지 않는다.

## Frontend Design Workflow

프론트엔드 디자인, 화면 구조 탐색, 디자인 시스템 정의, 화면 시안, 스타일 가이드는 **`stich MCP 서버 (Stitch)`를 우선 사용한다.**  
코드 구현은 그 결과를 기준으로 저장소에서 이어간다.

예외:

- 기존 화면의 작은 CSS 수정
- 단순 spacing 조정
- 비주얼 탐색이 필요 없는 순수 로직 작업

위 작업은 `stich MCP 서버` 의무 대상이 아니다.

## Track 1. Personal Archive Core UX

목표:

- Work Archive를 순수 개인용 작품 아카이브로 쓰기 좋은 핵심 화면으로 완성한다.

범위:

- direct manual add
- Quick Add search picker
- poster-first WorksList
- section-based WorkDetail
- review / rating / status / progress 입력
- empty / loading / error 상태 정리

디자인 원칙:

- 작품 추가는 form-first layout을 사용한다.
- 검색 결과 선택은 modal master-detail picker를 사용한다.
- 작품 목록은 poster-first grid를 사용한다.
- 작품 상세는 내 기록 중심 section layout을 사용한다.
- 카드 안 정보는 최소화한다. 목록 카드에서는 표지, 제목, 상태, 별점, favorite 정도만 우선 노출한다.
- 한줄평, 장르, 최근 수정일, 긴 진행도 텍스트는 상세 화면으로 보낸다.
- expandable card는 primary selection flow에 사용하지 않는다.

완료 기준:

- 검색 없이 제목을 입력해 저장할 수 있다.
- guest에서도 동작한다.
- 검색이 실패해도 직접 추가로 자연스럽게 이동할 수 있다.
- 목록은 표지 중심으로 탐색할 수 있다.
- 상세 화면은 작품 소개보다 내 기록이 먼저 보인다.

## Track 2. Data Ownership And Safety

목표:

- 개인용 앱으로서 사용자가 자신의 기록을 잃지 않고 옮길 수 있게 한다.

우선순위:

1. JSON export
2. JSON import
3. CSV export
4. 로컬 데이터 초기화 / 복구 안내
5. 휴지통 / 복원 UX polish
6. 중복 기록 정리 도구

완료 기준:

- guest도 자신의 기록을 export할 수 있다.
- export한 기록을 다시 import할 수 있다.
- 서비스/서버가 없어도 개인 데이터 소유권이 유지된다.

## Track 3. Personal Record Depth

목표:

- 단순 작품 목록을 넘어 개인 기록 앱으로서 깊이를 만든다.

우선순위:

1. 개인 태그
2. 감상 timeline
3. 재감상 / 재독 기록
4. 진행도 고도화
5. 개인 티어 / 컬렉션
6. 시작일 / 완료일 / 중단일

완료 기준:

- 사용자는 장르가 아니라 자신의 언어로 작품을 분류할 수 있다.
- 작품을 언제 시작하고, 어디까지 봤고, 어떤 감상을 남겼는지 기록할 수 있다.

## Track 4. Optional Private Sync Reliability

목표:

- 로그인은 선택형 백업/동기화 기능으로만 느껴지게 한다.

현재 구현:

- SyncPage는 pending / failed / conflict queue item 단위 상태를 표시한다.
- queue item별 원인, 기록 보기, 재시도 CTA를 제공한다.
- conflict 항목은 원격 스냅샷을 보존해 로컬 유지, 원격 적용, 필드별 병합으로 기본 해결할 수 있다.
- safe auto-merge는 동일 entity/parent와 동일 scalar 조건에서 taxonomy/alias/server metadata만 병합하고, 병합된 queue item을 재시도 대상으로 돌려보낸다.
- 자동 push는 conflict queue item을 전송하지 않고 SyncPage 수동 검토 대상으로 유지한다.
- guest local-first writes는 자동 pull/push를 시작하지 않고 account archive와 분리된다.

근거리 순서:

1. conflict 해결 UX polish와 safe auto-merge 정책 확장 여부 검토
2. 로그인/account archive activation 자동 pull 검증과 확장 검토
3. sync 상태 polish와 실패 복구 UX 개선
4. guest -> account 선택 import UX 정리
5. 백업/동기화가 꺼져 있어도 로컬 기록이 안전하다는 안내

완료 기준:

- local-first 저장 경로는 유지된다.
- 로그인은 기록 사용의 필수가 아니라 백업/동기화 옵션으로 보인다.
- 충돌 발생 시 사용자가 로컬 기록과 서버 기록을 비교하고 선택할 수 있다.

## Track 5. Search Quality And Catalog Assist

목표:

- 검색은 개인 기록 입력을 돕는 보조 기능으로 유지하면서 품질을 높인다.

현재 기준:

- backend `/imports/providers`와 `/imports/search`는 optional Authorization 기반이다.
- frontend imports service는 토큰이 있으면 authenticated request, 없으면 plain request를 보낸다.
- guest는 key가 필요 없는 provider 검색과 manual provider를 사용할 수 있고, user/server credential provider는 정책에 따라 제한된다.
- Quick Add 저장 흐름은 `catalogTitleId`, identity-only `importDraft`, manual/direct record를 구분한다.
- 검색 ranking은 제목 exact/alias/token, 제작자, 발매연도, provider/source coverage, catalog match를 반영한다.
- 낮은 신뢰도 후보는 직접 추가 fallback을 방해하지 않도록 후보 UI에서 검토 안내를 표시한다.

우선순위:

1. provider별 live 검색어 QA와 ranking weight 튜닝
2. source merge 표시 회귀 확인: 기본 브라우저 E2E로 고정됨
3. 검색 실패 fallback UX 회귀 확인: 기본 브라우저 E2E로 고정됨
4. 제목 alias / 원제 / 번역제 케이스 추가 수집
5. catalog identity 연결 보조

완료 기준:

- 검색 후보가 틀려도 수동 추가를 방해하지 않는다.
- manual fallback 후보는 자동 검색 결과처럼 표시하지 않는다.
- 검색 후보를 선택하면 local-first 저장 계약이 유지된다.
- catalog identity는 개인 기록을 대체하지 않고 보조 정보로만 사용된다.

## Track 6. Minimal Personal Insights

현재 구현:

- `/insights`는 MainProductLayout 아래 private local-first 화면으로 제공된다.
- guest와 로그인 사용자 모두 현재 활성 IndexedDB 아카이브에서만 통계를 계산한다.
- 총 기록 수, 매체/상태/별점 분포, 올해 완료, 최근 추가/수정, 개인 태그/장르, 즐겨찾기, 감상 공백 요약을 제공한다.
- public/community/share 기능과 연결하지 않는다.

목표:

- 커뮤니티가 없어도 개인 아카이브의 가치를 높이는 최소 통계를 제공한다.

우선순위:

1. 총 기록 수
2. 매체별 기록 수
3. 상태별 분포
4. 별점 분포
5. 올해 완료한 작품
6. 개인 태그/장르 요약
7. 즐겨찾기 / 다시 볼 작품 요약

완료 기준:

- 사용자는 자신의 기록을 요약해서 돌아볼 수 있다.
- 모든 insight는 개인 기록 기반이며 공개/랭킹/커뮤니티 기능과 연결하지 않는다.

## Out Of Scope. Public / Community / Social

현재 제품 범위 밖:

- public profile
- public works
- public review
- comments
- likes
- follow
- community timeline
- moderation
- catalog promotion workflow
- public aggregate ranking

원칙:

- 개인 기록은 기본 private다.
- 공개 여부를 설계하지 않는다.
- public/community 기능은 현재 roadmap에서 제거한다.
- 나중에 공유 기능을 만들더라도 export/share artifact 형태를 먼저 검토한다.

## Verification Gates

Phase 1+ 게이트:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 검색/ranking 변경 시 `npm run qa:import-search`
- sync 변경 시 `npm run qa:sync-load`
- `docker compose up --build`: 현재 문서 기준 미검증이면 미검증으로 유지한다.

문서에는 마지막 확인 날짜와 결과를 남긴다.
