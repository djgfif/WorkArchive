# docs/product/

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `navigation` |
| Source of truth | [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md), [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md) |
| Last verified against | `2026-04-22` working tree |
| When to update | product 문서 역할과 읽기 순서가 바뀔 때 |

이 폴더는 현재 구현 설명이 아니라 **제품 비전, 근거리 우선순위 요약, 확장 전략**을 다룬다.

## Read In This Order

1. [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
2. [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
3. [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md)
4. [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)
5. [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
6. [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)

## Document Roles

| Document | Role |
| --- | --- |
| [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md) | 근거리 제품 우선순위 요약 |
| [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md) | 프론트 5단계 상세 실행 기준 |
| [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md) | 최종 사용자 경험과 디자인 원칙 |
| [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md) | Mantine 기반 target UI system |
| [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md) | exploratory auth/guest strategy |
| [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md) | exploratory catalog/public architecture |

## Exploratory Appendix

아래의 Tier Board 메모는 navigation 문서의 부록으로만 유지한다. canonical 기준이 아니며, 실제 범위 판단은 별도 전략 문서가 생기면 그 문서로 이동한다.

### Tier Board MVP Strategy

#### Positioning

Tier Board는 작품 상세의 보조 필드가 아니라, **가볍고 공유 가능한 별도 보드 기능**으로 다룬다.

#### MVP Principles

- 복잡한 분석 툴이 아니라 빠른 배치와 공유가 핵심이다.
- 라이브러리 작품 카드와 커스텀 카드 두 종류만 우선 지원한다.
- 보드 생성, lane 편집, 카드 추가, 드래그 앤 드롭, 공개 링크, 이미지 export가 핵심 범위다.

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

- `TierBoard`는 소유자, 제목, 설명, 공개 범위, 타입을 가진다.
- `TierLane`은 순서와 제목을 가진다.
- `TierBoardCard`는 board 안에서 lane 위치, 정렬 순서, source type, 이미지/제목 override를 가진다.

#### Expansion Boundary

- 작품 연동은 `workId` 참조 수준으로만 시작한다.
- 캐릭터/히로인/밈 보드는 custom card 중심으로 수용한다.
