# DOCUMENTATION_INDEX.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `navigation` |
| Source of truth | 현재 문서 트리와 [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md) |
| Last verified against | `2026-04-22` working tree |
| When to update | 문서 경로, 읽는 순서, 주요 문서 역할이 바뀔 때 |

이 문서는 Work Archive 문서의 공식 탐색 진입점이다. 무엇을 먼저 읽어야 하는지와 각 문서가 어떤 역할을 가지는지 여기서 판단한다.

## 1. Quick Start

### 저장소를 처음 볼 때

1. [`../../README.md`](../../README.md)
2. [`../README.md`](../README.md)
3. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
4. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)

### 프론트 문서를 볼 때

1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
4. [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

### 백엔드 문서를 볼 때

1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
3. [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)

### 제품 방향과 로드맵을 볼 때

1. [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
2. [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
3. [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
4. [`../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)
5. [`../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
6. [`../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)

## 2. Canonical Documents

| Document | Status | Role | Use it when |
| --- | --- | --- | --- |
| [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) | `canonical` | `current reality` | 현재 구현 상태, 실제 라우트, 모듈, 세션 저장 방식, 검증 표면을 알고 싶을 때 |
| [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md) | `canonical` | `current frontend decisions` | 현재 UI/라우트/레이아웃 기준을 잡을 때 |
| [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md) | `canonical` | `target frontend structure` | 프론트의 다음 구조 작업 범위를 정할 때 |
| [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md) | `canonical` | `target backend structure` | 백엔드 도메인 경계와 장기 구조를 판단할 때 |
| [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md) | `canonical` | `governance` | 문서를 새로 만들거나 이동하려고 할 때 |
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | `canonical` | `navigation` | 어떤 문서를 먼저 읽을지 모를 때 |
| [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md) | `canonical` | `status map` | active/reference/canonical 구분이 필요할 때 |

## 3. Active Roadmaps And Vision Docs

| Document | Role | Use it when |
| --- | --- | --- |
| [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md) | `frontend roadmap` | 프론트 5단계 상세 실행 순서를 정할 때 |
| [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md) | `security roadmap` | 남은 공개 전/후 보안 backlog를 정할 때 |
| [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md) | `product priority summary` | 근거리 제품 우선순위와 사용자 가치 설명을 볼 때 |
| [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md) | `target product vision` | 최종 사용자 경험과 디자인 원칙을 볼 때 |
| [`../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md) | `target UI system` | Mantine 기반 UI 시스템 원칙을 볼 때 |
| [`../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md) | `exploratory strategy` | 게스트 유지와 구글 로그인 전략을 검토할 때 |
| [`../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md) | `exploratory architecture` | catalog/public/community 확장 구조를 검토할 때 |

## 4. Operational Prompt

| Document | Role | Use it when |
| --- | --- | --- |
| [`CODEX_FRONTEND_FOUNDATION_PROMPT.md`](./CODEX_FRONTEND_FOUNDATION_PROMPT.md) | `execution prompt` | 프론트 foundation refactor를 Codex에 바로 위임할 실행 프롬프트가 필요할 때 |

## 5. Historical Reference

다음 문서는 현재 코드 기준이 아니라 reference 문서다.

- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)
- [`../project/PLAN.md`](../project/PLAN.md)
- [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

이 문서들은 초기 의사결정과 milestone 맥락을 추적할 때만 사용한다.

## 6. Maintenance Rule

문서를 만들거나 이동하거나 이름을 바꾸면 최소 다음을 함께 갱신한다.

1. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
2. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
3. 관련 폴더 `README.md`
4. 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)
