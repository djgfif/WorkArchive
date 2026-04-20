# DOCUMENT_STATUS_MATRIX.md

## 목적
이 문서는 Work Archive 주요 문서의 현재 위치, status, 해석 방식을 한 표로 관리한다. 무엇이 현재 현실 설명 문서인지, 무엇이 목표 구조 문서인지, 무엇이 역사 문서인지 여기서 구분한다.

상세 운영 규칙은 [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)를, 전체 탐색 순서는 [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)를 따른다.

---

## 1. Status 정의 요약

### canonical
현재 따라야 하는 기준 문서.

### active
현재 자주 참고하지만 canonical은 아닌 문서.

### reference
과거 맥락과 초기 의사결정 참고용 문서.

### archived
현재 기준에서 명확히 내려온 과거 문서.

---

## 2. 현재 문서 상태 분류표

| 경로 | Status | 영역 | 해석 방식 | 역할 요약 |
|---|---|---|---|---|
| [`../../README.md`](../../README.md) | active | root/project | operational entrypoint | 설치, 실행, 환경 설정, 저장소 시작점 |
| [`../README.md`](../README.md) | active | docs | navigation hub | docs 전체 구조와 진입점 안내 |
| [`../project/README.md`](../project/README.md) | active | project | navigation | project 폴더 읽기 순서 안내 |
| [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) | canonical | project/product | current reality | 현재 구현 상태와 단기 계획의 기준 보고서 |
| [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md) | reference | project | historical reference | 초기 요구사항과 기본 범위 참고 |
| [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md) | reference | project | historical reference | 초기 구현 구조와 단계 참고 |
| [`../project/PLAN.md`](../project/PLAN.md) | reference | project | historical reference | milestone 기반 진행 계획 참고 |
| [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md) | reference | project | historical reference | 초기 구현 지시와 흐름 참고 |
| [`../product/README.md`](../product/README.md) | active | product | navigation | product 폴더 읽기 순서 안내 |
| [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md) | active | product | target vision | 최종 제품/웹 UX 비전 문서 |
| [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md) | active | product/frontend | target roadmap | 상용 수준 웹 구현 로드맵 |
| [`../frontend/README.md`](../frontend/README.md) | active | frontend | navigation | frontend 폴더 읽기 순서 안내 |
| [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md) | canonical | frontend | current canonical decisions | 현재 프론트 설계 고정값 |
| [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md) | canonical | frontend | target canonical structure | 프론트 목표 구조와 레이아웃 재정의 기준 |
| [`../backend/README.md`](../backend/README.md) | active | backend | navigation | backend 폴더 읽기 순서 안내 |
| [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md) | canonical | backend | target canonical structure | 백엔드 도메인 재설계 기준 |
| [`README.md`](./README.md) | active | management | navigation | management 폴더 안내 |
| [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md) | canonical | management | governance | 문서 운영 규칙과 archive 기준 |
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | canonical | management | navigation | 읽는 순서와 문서 위치 기준 |
| [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md) | canonical | management | status map | status와 해석 방식 기준 |
| [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md) | active | management | interpretation guide | 코드 기준과 문서 기준의 거리 설명 |
| [`../archive/README.md`](../archive/README.md) | active | archive | archive policy | archive 목적과 이동 기준 안내 |

---

## 3. 현재 가장 중요한 canonical 문서

### 프로젝트 현실
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

### 프론트 기준
- [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

### 백엔드 기준
- [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### 문서 체계 기준
- [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
- [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
- [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)

---

## 4. active 문서

다음 문서는 자주 참고하지만 canonical은 아니다.
- [`../../README.md`](../../README.md)
- [`../README.md`](../README.md)
- 각 폴더의 `README.md`
- [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)
- [`../archive/README.md`](../archive/README.md)

해석 원칙:
- README 계열은 탐색/운영 보조 문서다
- product 문서는 현재 구현 설명보다 미래 비전/로드맵 문서다
- alignment report는 상태와 목표의 간격을 읽는 문서다

---

## 5. reference 문서

reference 문서는 모두 [`../project/`](../project/README.md) 아래에 둔다.
- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)
- [`../project/PLAN.md`](../project/PLAN.md)
- [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

이 문서들은 삭제 대상이 아니라 역사 보존 대상이다. 다만 source of truth처럼 사용하면 안 된다.

---

## 6. archived 상태에 대한 현재 판단

현재 실제 archive된 문서는 없다. 이번 패스에서는 [`../archive/README.md`](../archive/README.md)만 만들고, 실제 문서 이동은 보수적으로 보류했다.

archive 후보 판단 기준:
- 현재 구현/설계와 강하게 충돌한다
- 대체 문서가 명확하다
- 다시 읽을 필요가 거의 없다

---

## 7. 실전 사용 규칙

### 프론트 작업 전
1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

### 백엔드 작업 전
1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### 프로젝트 전체 방향 확인 전
1. [`../../README.md`](../../README.md)
2. [`../README.md`](../README.md)
3. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
4. 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

### 문서 구조를 수정하기 전
1. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
2. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
3. [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)

---

## 8. 최종 정리

이 저장소에서 가장 중요한 구분은 다음 네 가지다.
- current reality
- current canonical decisions
- target canonical structure
- historical reference

이 표는 그 구분을 파일 경로까지 포함해 유지하는 기준표로 사용한다.
