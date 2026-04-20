# CODE_DOCUMENT_ALIGNMENT_REPORT.md

## 목적
이 문서는 Work Archive의 실제 코드 상태와 문서 체계를 비교해서, 어떤 문서를 현재 현실 문서로 읽어야 하는지, 어떤 문서를 목표 구조 문서로 읽어야 하는지 정리한다.

이번 문서 재구성 이후에는 내용뿐 아니라 **문서 위치 자체도 해석 신호**가 된다. `docs/project/`는 현재 상태와 역사 문맥을, `docs/product/`, `docs/frontend/`, `docs/backend/`는 목표 방향 문서를 더 많이 담는다.

---

## 1. 현재 코드와 가장 밀접한 문서

### 1-1. 루트 README
- 문서: [`../../README.md`](../../README.md)
- 역할: 실행, 환경 설정, 저장소 시작점
- 해석: 운영 문서

이 문서는 코드베이스를 실제로 실행하는 데 필요한 정보와 가장 밀접하다.

### 1-2. Current Status Report
- 문서: [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- 역할: 현재 구현 상태와 단기 계획의 기준 보고서
- 해석: current reality canonical

현재 코드 현실을 가장 직접적으로 설명하는 문서는 이 문서다.

### 1-3. Frontend Blueprint
- 문서: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- 역할: 현재 프론트 설계 고정값
- 해석: current canonical decisions

프론트 구현 판단 시 가장 신뢰해야 하는 기준 문서다.

### 1-4. Management 문서
- 문서: [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md), [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md), [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
- 역할: 문서를 어떻게 해석할지에 대한 기준
- 해석: code 설명 문서는 아니지만 현재 문서 구조와 일치

이번 재구성 이후 이 문서들은 실제 저장소 구조와 직접 맞물린다.

---

## 2. 코드보다 앞서 있는 문서

### 2-1. Frontend Foundation Masterplan
- 문서: [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
- 해석: target canonical structure

방향은 유효하지만 현재 코드 구현보다 앞선 목표 구조다.

### 2-2. Backend Service Redesign Masterplan
- 문서: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 해석: target canonical structure

현재 백엔드의 한계를 설명하는 데는 정확하지만, 구현 완료 상태를 설명하는 문서는 아니다.

### 2-3. Final Web Design
- 문서: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- 해석: target vision

최종 제품 경험과 상용형 웹 UX 비전을 설명하는 문서다.

### 2-4. Commercial Web Design Implementation Plan
- 문서: [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- 해석: target roadmap

실제 구현 완료 상태가 아니라, 앞으로 따라갈 개선 로드맵이다.

---

## 3. 역사 문맥으로 유지하는 문서

다음 문서는 여전히 유용하지만 current reality나 canonical source of truth로 읽으면 안 된다.
- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)
- [`../project/PLAN.md`](../project/PLAN.md)
- [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

이번 패스에서는 이 문서들을 archive로 보내지 않고 [`../project/`](../project/README.md)에 유지했다. 이유는 다음과 같다.
- 초기 의사결정 맥락이 아직 살아 있다
- 현재 문서와 비교할 때 참고 가치가 남아 있다
- 성급한 archive보다 구조 정리가 우선이다

---

## 4. 문서 구조 재구성의 영향

### 4-1. 루트 정리
다음 문서는 루트에서 각 주제 폴더로 이동했다.
- project: [`../project/`](../project/README.md)
- product: [`../product/`](../product/README.md)
- frontend: [`../frontend/`](../frontend/README.md)
- backend: [`../backend/`](../backend/README.md)
- management: [`./README.md`](./README.md)

효과:
- 루트가 운영 파일 중심으로 정리된다
- 주제별 탐색 경로가 안정된다
- Codex와 사람 모두 경로만 보고 문서 성격을 추정하기 쉬워진다

### 4-2. 의미는 유지하고 위치만 정리
이번 재구성은 주로 아래를 목표로 했다.
- 경로 정리
- 링크 정리
- 읽는 순서 정리
- source-of-truth 규칙 명시

즉, 문서의 핵심 의미를 바꾸기보다 해석 비용을 낮추는 쪽에 집중했다.

### 4-3. compatibility shim은 두지 않음
루트에 이동된 문서의 stub 파일은 남기지 않았다.

이유:
- 문서 중복과 경로 혼란을 줄이기 위해서다
- 새 위치를 single source of navigation으로 만들기 위해서다

---

## 5. 현재 권장 읽기 순서

### 현재 코드 현실 확인
1. [`../../README.md`](../../README.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)

### 프론트 판단
1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

### 백엔드 판단
1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### 문서 해석 규칙 확인
1. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
2. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
3. [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)

---

## 6. 운영 권장 사항

### 권장 사항 1
코드 변경 후 가장 먼저 갱신할 문서는 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)다.

### 권장 사항 2
프론트 구조 변경 시 [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)와 [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)를 함께 검토한다.

### 권장 사항 3
백엔드 구조 변경 시 [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)를 함께 검토한다.

### 권장 사항 4
문서를 새로 만들거나 이동할 때는 [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)와 [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)를 같은 커밋에서 갱신한다.

---

## 7. 최종 정리

현재 Work Archive 문서는 다음 구도로 읽으면 된다.
- current reality: [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- current frontend decisions: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- target structures: [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md), [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- target product vision: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md), [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- historical reference: [`../project/`](../project/README.md) 아래 reference 문서

이 구분이 유지되면 문서가 많아도 해석 비용은 크게 줄어든다.
