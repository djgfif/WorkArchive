# docs/frontend/

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `navigation` |
| Source of truth | [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md) |
| Last verified against | `2026-04-24` working tree |
| When to update | 프론트 기준 문서 구성과 읽기 순서가 바뀔 때 |

이 폴더는 현재 프론트 기준, 남은 구조 과제, Mantine 전환 상세 실행 계획을 다룬다.

## Read In This Order

1. [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md)
4. [`FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

## Document Roles

- 현재 프론트 canonical: [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md)
- 목표 구조 canonical: [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md)
- 프론트 5단계 상세 실행 로드맵: [`FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

## Design Workflow Rule

프론트엔드 디자인, 화면 구조 탐색, 디자인 시스템 정의, 화면 시안, 스타일 가이드는 **`stich MCP 서버 (Stitch)`를 우선 사용한다.**

예외:

- 기존 화면의 작은 CSS 수정
- 단순 spacing 조정
- 비주얼 탐색이 필요 없는 순수 로직 작업

위 작업은 `stich MCP 서버` 의무 대상이 아니다.
