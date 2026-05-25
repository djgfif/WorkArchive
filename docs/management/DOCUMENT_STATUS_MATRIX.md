# DOCUMENT_STATUS_MATRIX.md

| Field                 | Value                                            |
| --------------------- | ------------------------------------------------ |
| Status                | `canonical`                                      |
| Role                  | `status map`                                     |
| Source of truth       | 현재 문서 트리와 문서 상단 metadata              |
| Last verified against | `2026-04-24` working tree                        |
| When to update        | 문서 status, 역할, authoritative scope가 바뀔 때 |

이 표는 주요 문서를 `canonical`, `active`, `reference`, `archived`로 구분하는 기준표다.

## Status Definitions

- `canonical`: 현재 따라야 하는 기준 문서
- `active`: 자주 읽지만 기준 문서는 아닌 문서
- `reference`: 역사 문맥용 문서
- `archived`: 현재 기준에서 내려간 문서

## Current Matrix

| Path                                                                                                                 | Status      | Role                           | Authoritative for                                                    | Not authoritative for                           |
| -------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------- |
| [`../../README.md`](../../README.md)                                                                                 | `active`    | `operational entrypoint`       | 실행, 환경 변수, 명령어, 현재 검증 상태                              | 장기 제품/구조 설계                             |
| [`../README.md`](../README.md)                                                                                       | `active`    | `documentation hub`            | docs 폴더 진입                                                       | 세부 도메인 판단                                |
| [`../project/README.md`](../project/README.md)                                                                       | `active`    | `navigation`                   | project 폴더 읽기 순서                                               | 현재 구현 세부 사항                             |
| [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)         | `canonical` | `current reality`              | 현재 구현 상태, 라우트, 모듈, 세션 저장 방식, 검증 표면              | 장기 비전의 상세 설계                           |
| [`../project/EXECUTION_ROADMAP.md`](../project/EXECUTION_ROADMAP.md)                                                 | `canonical` | `integrated execution roadmap` | near-term 실행 순서, phase boundaries, frontend design workflow rule | 현재 구현의 세부 사실, 장기 구조 전체           |
| [`../archive/project/PROJECT_SPEC.md`](../archive/project/PROJECT_SPEC.md)                                           | `archived`  | `historical reference`         | 초기 요구사항과 범위 맥락                                            | 현재 코드 상태                                  |
| [`../archive/project/IMPLEMENTATION_PLAN.md`](../archive/project/IMPLEMENTATION_PLAN.md)                             | `archived`  | `historical reference`         | 초기 구현 구조와 단계                                                | 현재 구조 기준                                  |
| [`../archive/project/PLAN.md`](../archive/project/PLAN.md)                                                           | `archived`  | `historical reference`         | milestone 진행 기록                                                  | 현재 우선순위                                   |
| [`../archive/project/IMPLEMENT.md`](../archive/project/IMPLEMENT.md)                                                 | `archived`  | `historical reference`         | 초기 구현 지시 맥락                                                  | 현재 코드 판단                                  |
| [`../frontend/README.md`](../frontend/README.md)                                                                     | `active`    | `navigation`                   | frontend 폴더 읽기 순서                                              | 현재 UI 세부 판단                               |
| [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)                                       | `canonical` | `current frontend decisions`   | 현재 프론트 UI/라우트/레이아웃 기준                                  | 미래 제품 비전                                  |
| [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)                     | `canonical` | `target frontend structure`    | 남은 구조 과제와 다음 분해 기준                                      | 현재 구현 완료 상태                             |
| [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)           | `active`    | `frontend roadmap`             | 프론트 5단계 상세 실행 순서                                          | 현재 구현 설명, 제품 비전                       |
| [`../engineering/FEATURE_FIRST_STRUCTURE.md`](../engineering/FEATURE_FIRST_STRUCTURE.md)                             | `canonical` | `architecture boundary guide`  | monorepo, web feature, API module 경계                               | 세부 제품 비전                                  |
| [`../backend/README.md`](../backend/README.md)                                                                       | `active`    | `navigation`                   | backend 폴더 읽기 순서                                               | 현재 API 세부 구현                              |
| [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)             | `canonical` | `target backend structure`     | 백엔드 도메인 경계와 장기 구조                                       | 현재 구현 완료 상태                             |
| [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)                               | `active`    | `security roadmap`             | 남은 공개 전/후 보안 backlog                                         | 현재 코드가 이미 가진 baseline 전체             |
| [`../product/README.md`](../product/README.md)                                                                       | `active`    | `navigation`                   | product 폴더 읽기 순서                                               | 현재 구현 상태                                  |
| [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md) | `active`    | `product priority summary`     | 근거리 제품 우선순위와 사용자 가치 설명                              | 프론트 상세 기술 단계                           |
| [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)                                                   | `active`    | `target product vision`        | 최종 사용자 경험과 디자인 원칙                                       | 현재 라우트/상태                                |
| [`../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](../product/CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)                   | `active`    | `target UI system`             | Mantine 기반 UI 시스템 원칙                                          | 현재 스타일 구현, 단계별 체크리스트             |
| [`../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](../product/AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)               | `active`    | `exploratory strategy`         | 향후 인증/게스트 전략                                                | 현재 인증 구현                                  |
| [`../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](../product/VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)     | `active`    | `exploratory architecture`     | catalog/public/community 확장 구조                                   | 현재 데이터 모델                                |
| [`README.md`](./README.md)                                                                                           | `active`    | `navigation`                   | management 폴더 안내                                                 | 규칙의 본문                                     |
| [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)                                                       | `canonical` | `governance`                   | 문서 운영 규칙                                                       | 현재 코드 현실                                  |
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)                                                                 | `canonical` | `navigation`                   | 읽는 순서와 대표 문서                                                | status 표의 세부 근거                           |
| [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)                                                           | `canonical` | `status map`                   | 문서 status와 authoritative scope                                    | 세부 설계 내용                                  |
| [`CODEX_FRONTEND_FOUNDATION_PROMPT.md`](./CODEX_FRONTEND_FOUNDATION_PROMPT.md)                                       | `active`    | `execution prompt`             | 프론트 foundation refactor를 Codex에 위임할 실행 프롬프트            | 현재 코드 현실의 canonical 설명, 장기 구조 기준 |
| [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)                                           | `active`    | `alignment report`             | intentional gap 설명                                                 | 기준 문서 자체                                  |
| [`../archive/README.md`](../archive/README.md)                                                                       | `active`    | `archive policy`               | archive 운영 기준                                                    | 현재 문서 기준                                  |
