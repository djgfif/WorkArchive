# EXECUTION_ROADMAP.md

| Field                 | Value                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                | `canonical`                                                                                                                                                                                                                                      |
| Role                  | `integrated execution roadmap`                                                                                                                                                                                                                   |
| Source of truth       | [`PRODUCT_DIRECTION_LOCK.md`](../product/PRODUCT_DIRECTION_LOCK.md), [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](./CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), current `apps/web` / `apps/api` implementation, `README.md` verification commands |
| Last verified against | `2026-04-30` sync conflict resolution working tree                                                                                                                                                                                               |
| When to update        | near-term execution order, phase boundaries, guest/login policy, frontend design workflow rule, or verification gates change                                                                                                                     |

이 문서는 Work Archive의 **단일 통합 실행 로드맵**이다. current reality 문서를 대체하지 않고, 지금 무엇을 어떤 순서로 고정해야 하는지만 정리한다.

## Summary

- 제품 본질은 **순수 개인용 local-first 작품 기록/리뷰 아카이브**다.
- 로그인은 선택이다. 꼭 계정이 필요한 기능이 아니라면 guest도 사용할 수 있어야 한다.
- 공개 프로필, 공개 리뷰, 커뮤니티, 팔로우, 댓글, moderation은 현재 제품 범위 밖이다.
- 현재 제품 기준은 `direct manual add + optional-auth server-assisted search + local-first save`다.
- Manual Add, guest no-key provider search, Quick Add identity 저장, duplicate detection, backend sync create 순서는 테스트로 고정돼 있다.
- 검색은 diagnostics, normalization, merge/dedupe, ranking, sourceCoverage, manual fallback 분리까지 2차 고도화가 진행됐고, 남은 작업은 실제 검색어 QA와 튜닝이다.
- 수정된 우선순위는 `개인 기록 UX -> export/import -> 개인 기록 깊이 -> optional private sync -> search quality -> personal Insights`다.
- `Public`, `Community`, `Social`, `Catalog moderation` 계열 작업은 무기한 보류한다.

## Product Direction Lock

우선 읽을 기준 문서:

- [`../product/PRODUCT_DIRECTION_LOCK.md`](../product/PRODUCT_DIRECTION_LOCK.md)

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

근거리 순서:

1. conflict 해결 UX polish와 자동 병합 정책 검토
2. 로그인 직후 pull 자동화 검토
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

우선순위:

1. provider ranking/search quality 개선
2. source merge 표시 회귀 확인
3. 검색 실패 fallback UX 회귀 확인
4. 제목 alias / 원제 / 번역제 대응
5. catalog identity 연결 보조

완료 기준:

- 검색 후보가 틀려도 수동 추가를 방해하지 않는다.
- manual fallback 후보는 자동 검색 결과처럼 표시하지 않는다.
- 검색 후보를 선택하면 local-first 저장 계약이 유지된다.
- catalog identity는 개인 기록을 대체하지 않고 보조 정보로만 사용된다.

## Track 6. Minimal Personal Insights

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

- `npm run typecheck`
- `npm run test --workspace @work-archive/web`
- `npm run test --workspace @work-archive/api`
- `npm run build`
- `docker compose up --build`: 현재 문서 기준 미검증이면 미검증으로 유지한다.

문서에는 마지막 확인 날짜와 결과를 남긴다.
