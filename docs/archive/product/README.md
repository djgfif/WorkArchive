# docs/product/

| Field                 | Value                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                | `active`                                                                                                                                                                                                     |
| Role                  | `navigation`                                                                                                                                                                                                 |
| Source of truth       | [`PRODUCT_DIRECTION_LOCK.md`](./PRODUCT_DIRECTION_LOCK.md), [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md), [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md) |
| Last verified against | `2026-07-03` public beta personal-only direction audit                                                                                                                                                       |
| When to update        | product 문서 역할, 읽기 순서, 제품 본질, guest/login 정책이 바뀔 때                                                                                                                                          |

이 폴더는 **제품 본질, 근거리 우선순위, 디자인 방향, 확장 전략**을 다룬다.

가장 중요한 기준은 [`PRODUCT_DIRECTION_LOCK.md`](./PRODUCT_DIRECTION_LOCK.md)다. Work Archive의 본질은 커뮤니티나 서버 중심 카탈로그가 아니라, **내가 본 작품을 정리하고 리뷰를 남기는 개인 local-first 작품 아카이브**다.

## Read In This Order

1. [`PRODUCT_DIRECTION_LOCK.md`](./PRODUCT_DIRECTION_LOCK.md)
2. [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
3. [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
4. [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md)
5. [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)
6. [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
7. [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)
8. [`INSIGHTS_IMPLEMENTATION_PLAN.md`](./INSIGHTS_IMPLEMENTATION_PLAN.md)
9. [`DUPLICATE_CLEANUP_POLICY.md`](./DUPLICATE_CLEANUP_POLICY.md)

## Direction Lock Summary

앞으로 제품 판단은 아래 기준을 우선한다.

- 1순위는 개인 작품 기록/리뷰 아카이브다.
- 로그인은 선택이다.
- 꼭 계정이 필요한 기능이 아니라면 guest도 사용할 수 있어야 한다.
- 수동 추가는 핵심 기능이다.
- key가 필요 없는 검색 provider는 비로그인 사용자에게도 제공하는 방향으로 구현한다.
- 개인 기록 데이터와 서버/catalog 보조 데이터는 별도 plane으로 유지하고, community/public surface는 Gate 1 범위 밖에 둔다.
- sync는 개인 기록 백업/동기화 문제이고, catalog promotion은 공용 카탈로그 검수 문제다.
- community/public/social surface는 현재 기본 경로가 아니며 공개 베타 Gate 1에서 구현하지 않는다.

## Document Roles

| Document                                                                                                   | Role                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`PRODUCT_DIRECTION_LOCK.md`](./PRODUCT_DIRECTION_LOCK.md)                                                 | 제품 본질, guest/login 정책, 개인 기록과 서버/catalog/community 경계 고정 |
| [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)           | 근거리 제품 우선순위 요약                                                 |
| [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md) | 프론트 5단계 상세 실행 기준                                               |
| [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md)                                                             | 최종 사용자 경험과 디자인 원칙                                            |
| [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)                             | Mantine 기반 target UI system                                             |
| [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)                         | exploratory auth/guest strategy                                           |
| [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)               | exploratory catalog/public architecture                                   |
| [`INSIGHTS_IMPLEMENTATION_PLAN.md`](./INSIGHTS_IMPLEMENTATION_PLAN.md)                                     | personal-only Insights v1 implementation plan                             |
| [`DUPLICATE_CLEANUP_POLICY.md`](./DUPLICATE_CLEANUP_POLICY.md)                                             | private local duplicate detection and merge safety policy                 |

## Exploratory Appendix

아래의 Tier Board 메모는 navigation 문서의 부록으로만 유지한다. canonical 기준이 아니며, 실제 범위 판단은 별도 전략 문서가 생기면 그 문서로 이동한다.

### Tier Board MVP Strategy

#### Positioning

Tier Board는 작품 상세의 보조 필드가 아니라, **개인 기록을 정리하는 별도 보드 기능**으로 다룬다.

단, 이 기능도 개인 아카이브가 안정화된 뒤에 붙인다. Gate 1에서는 hosted public sharing을 만들지 않고, private archive 저장 경로와 공개 기능을 섞지 않는다.

#### MVP Principles

- 복잡한 분석 툴이 아니라 빠른 배치, 개인 정리, 로컬 export가 핵심이다.
- 라이브러리 작품 카드와 커스텀 카드 두 종류만 우선 지원한다.
- 보드 생성, lane 편집, 카드 추가, 드래그 앤 드롭, 이미지 export가 핵심 범위다. 공개 링크나 public browse surface는 Gate 1 범위 밖이다.

#### What Not To Do First

- 전투력 수치 시스템
- 캐릭터 전용 상세 도메인
- 과도한 자동 추천
- 복잡한 moderation 규칙

### Tier Board Domain Model Draft

#### Core Entities

- `TierBoard`
- `TierLane`
- `TierBoardCard`

#### Minimal Model Direction

- `TierBoard`는 소유자, 제목, 설명, Gate 1 기본 비공개 visibility, 타입을 가진다.
- `TierLane`은 순서와 제목을 가진다.
- `TierBoardCard`는 board 안에서 lane 위치, 정렬 순서, source type, 이미지/제목/메모 snapshot을 가진다.

#### Expansion Boundary

- Tier Board는 작품 상세의 하위 기능이 아니라 독립 기능이다.
- 작품 목록에서 가져온 카드는 생성 시점의 `title` / `subtitle` / `imageUrl` / `note` snapshot이다.
- `workId`는 카드 생성 source metadata로만 취급하며, 원본 작품 수정/삭제가 티어보드 카드 sync나 export를 막으면 안 된다.
- 작품 상세 화면에서 티어보드 역참조를 만들지 않는다.
- 캐릭터/히로인/밈 보드는 custom card 중심으로 수용한다.
