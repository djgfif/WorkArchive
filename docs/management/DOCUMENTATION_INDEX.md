# DOCUMENTATION_INDEX.md

## 목적
이 문서는 Work Archive 문서를 빠르게 탐색하기 위한 공식 인덱스다. 무엇을 먼저 읽어야 하는지, 어떤 문서가 현재 현실을 설명하는지, 어떤 문서가 목표 구조를 설명하는지 이 문서에서 판단한다.

관련 운영 규칙은 [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)를 따른다. 문서 상태는 [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)를 기준으로 해석한다.

---

## 1. 가장 먼저 볼 문서

### 프로젝트 전체를 빠르게 파악하고 싶을 때
1. [`../../README.md`](../../README.md)
2. [`../README.md`](../README.md)
3. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
4. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)

### 프론트엔드 기준을 알고 싶을 때
1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
4. 필요 시 [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
5. 필요 시 [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)

### 백엔드 기준을 알고 싶을 때
1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
3. 필요 시 [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
4. 필요 시 [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)

### 문서 체계 자체를 이해하고 싶을 때
1. [`../README.md`](../README.md)
2. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
3. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
4. [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
5. 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

---

## 2. 폴더별 탐색

### Project
- 안내: [`../project/README.md`](../project/README.md)
- 핵심 문서: [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- 참고 문서: [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md), [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md), [`../project/PLAN.md`](../project/PLAN.md), [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

### Product
- 안내: [`../product/README.md`](../product/README.md)
- 핵심 문서: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- 실행 로드맵: [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)

### Frontend
- 안내: [`../frontend/README.md`](../frontend/README.md)
- 현재 기준: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- 목표 구조: [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

### Backend
- 안내: [`../backend/README.md`](../backend/README.md)
- 핵심 문서: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### Management
- 안내: [`README.md`](./README.md)
- 인덱스: [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
- 상태표: [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
- 운영 규칙: [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
- 정합성 보고서: [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

### Archive
- 안내: [`../archive/README.md`](../archive/README.md)
- 현재 상태: 구조만 생성, 실제 archive 이동은 보수적으로 진행

---

## 3. 문서 목록과 역할

| 구분 | 문서 | Status | 해석 방식 | 언제 보는가 |
|---|---|---|---|---|
| root | [`../../README.md`](../../README.md) | active | 운영 시작점 | 설치, 실행, 환경 설정 |
| hub | [`../README.md`](../README.md) | active | 문서 허브 | docs 구조를 먼저 파악할 때 |
| project | [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md) | canonical | current reality | 현재 구현 상태와 단기 계획 |
| project | [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md) | reference | historical reference | 초기 요구사항 확인 |
| project | [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md) | reference | historical reference | 초기 구현 구조 확인 |
| project | [`../project/PLAN.md`](../project/PLAN.md) | reference | historical reference | milestone 흐름 추적 |
| project | [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md) | reference | historical reference | 초기 구현 지시 맥락 확인 |
| product | [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md) | active | target vision | 최종 제품/웹 UX 비전 확인 |
| product | [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md) | active | target roadmap | 상용화 구현 로드맵 확인 |
| frontend | [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md) | canonical | current canonical decisions | 현재 프론트 설계 기준 확인 |
| frontend | [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md) | canonical | target canonical structure | 프론트 목표 구조 확인 |
| backend | [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md) | canonical | target canonical structure | 백엔드 재설계 기준 확인 |
| management | [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md) | canonical | governance | 문서 운영 규칙 확인 |
| management | [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | canonical | navigation | 읽는 순서와 위치 확인 |
| management | [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md) | canonical | status map | canonical / active / reference 판단 |
| management | [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md) | active | interpretation guide | 코드 기준과 문서 기준 차이 확인 |

---

## 4. Source Of Truth 요약

### 현재 코드 현실
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

### 현재 프론트 canonical
- [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)

### 현재 프론트 목표 구조 canonical
- [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

### 현재 백엔드 목표 구조 canonical
- [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### 현재 제품 현실
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

### 미래 제품 비전
- [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)

### 역사적 참고
- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)
- [`../project/PLAN.md`](../project/PLAN.md)
- [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

---

## 5. 추천 읽기 순서

### Case 1. 새 기여자가 저장소에 들어왔다
1. [`../../README.md`](../../README.md)
2. [`../README.md`](../README.md)
3. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
4. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)

### Case 2. 프론트 구조를 만지려 한다
1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
4. 필요 시 [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)

### Case 3. 백엔드 구조를 만지려 한다
1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
3. 필요 시 [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)

### Case 4. 문서를 새로 만들지 고민 중이다
1. [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
2. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
3. [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

---

## 6. Archive 메모

archive 폴더는 이번 패스에서 구조만 생성했다. reference 문서라도 현재 맥락 이해에 여전히 유용한 문서는 당분간 각 주제 폴더에 유지한다.

---

## 7. 최종 정리

이 인덱스는 Work Archive 문서의 공식 탐색 진입점이다. 경로가 바뀌거나 문서 status가 달라지면 가장 먼저 이 문서를 갱신한다.
