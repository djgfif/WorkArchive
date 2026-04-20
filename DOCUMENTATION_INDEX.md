# DOCUMENTATION_INDEX.md

## 목적
이 문서는 Work Archive 저장소 안의 문서를 **한눈에 찾고**, **무엇을 먼저 읽어야 하는지**, **어떤 문서가 현재 코드 기준인지**, **어떤 문서가 목표/재설계 문서인지** 빠르게 판단하기 위한 인덱스다.

문서가 많아질수록 중요한 것은 문서 수를 줄이는 것보다,
**기준 문서와 참고 문서를 분명히 나누는 것**이다.

이 인덱스는 그 역할을 담당한다.

관련 운영 규칙은 `DOCUMENTATION_GOVERNANCE.md`를 따른다.
문서와 코드의 정합성 판단은 `CODE_DOCUMENT_ALIGNMENT_REPORT.md`를 따른다.

---

## 1. 가장 먼저 볼 문서

### 프로젝트 전체 상태를 알고 싶을 때
1. `README.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENTATION_GOVERNANCE.md`
4. `DOCUMENTATION_INDEX.md`

### 프론트엔드 기준을 알고 싶을 때
1. `FRONTEND_BLUEPRINT_V1.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `FRONTEND_FOUNDATION_MASTERPLAN.md`
4. `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`
5. `FINAL_WEB_DESIGN.md`

### 백엔드 기준을 알고 싶을 때
1. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
2. `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
3. `PROJECT_SPEC.md`
4. `IMPLEMENTATION_PLAN.md`

### 문서와 실제 코드의 차이를 알고 싶을 때
1. `CODE_DOCUMENT_ALIGNMENT_REPORT.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENT_STATUS_MATRIX.md`

---

## 2. 문서 목록과 역할

## A. 프로젝트 기본 문서

### README.md
- Status: active
- 역할: 프로젝트 개요, 실행 방법, 환경 설정, 개발 시작점
- 언제 보는가: 저장소를 처음 이해할 때

### PROJECT_SPEC.md
- Status: reference
- 역할: 초기 프로젝트 요구사항/스펙 참고
- 언제 보는가: 과거 요구사항과 기본 범위를 확인할 때

### IMPLEMENTATION_PLAN.md
- Status: reference
- 역할: 초기 구현 계획 참고
- 언제 보는가: 예전 구현 범위와 단계 구성을 확인할 때

### PLAN.md
- Status: reference
- 역할: 단계별 검증/실행 계획 참고
- 언제 보는가: 과거 milestone 흐름을 추적할 때

### IMPLEMENT.md
- Status: reference
- 역할: 구현 지시/기록 참고
- 언제 보는가: 초기 구현 과정의 문맥이 필요할 때

---

## B. 현재 상태 / 코드 기준 문서

### CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md
- Status: canonical
- 역할: 현재 구현 상태 + 미래 계획을 함께 설명하는 기준 보고서
- 언제 보는가: “지금 코드가 어디까지 와 있고, 앞으로 무엇을 할지” 빠르게 파악할 때

### CODE_DOCUMENT_ALIGNMENT_REPORT.md
- Status: active
- 역할: 문서와 실제 코드의 정합성 비교 보고서
- 언제 보는가: 어떤 문서가 현실을 설명하고 어떤 문서가 목표를 설명하는지 구분할 때

---

## C. 제품 / 디자인 방향 문서

### FINAL_WEB_DESIGN.md
- Status: active
- 역할: 최종 웹디자인 방향과 UX 비전 문서
- 언제 보는가: 제품이 궁극적으로 어떤 화면과 UX를 지향하는지 확인할 때
- 주의: 현재 코드보다 앞서 있는 비전 문서로 읽는다

### COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md
- Status: active
- 역할: 상용 수준 웹디자인 구현 계획서
- 언제 보는가: 웹을 실제 서비스 수준으로 끌어올리는 단계별 계획이 필요할 때
- 주의: 현재 상태 설명보다 개선 로드맵 문서에 가깝다

---

## D. 프론트엔드 기준 문서

### FRONTEND_BLUEPRINT_V1.md
- Status: canonical
- 역할: 사용자의 결정이 반영된 프론트엔드 고정 설계도 v1
- 언제 보는가: 현재 프론트의 source of truth가 필요할 때

### FRONTEND_FOUNDATION_MASTERPLAN.md
- Status: canonical
- 역할: 프로젝트형 화면 구조를 실제 웹서비스형 구조로 바꾸기 위한 프론트 기반 구조 문서
- 언제 보는가: 왜 레이아웃 분리와 페이지 경험 분리가 필요한지 판단할 때
- 주의: 현재 코드 설명 문서라기보다 목표 구조 문서다

---

## E. 백엔드 기준 문서

### BACKEND_SERVICE_REDESIGN_MASTERPLAN.md
- Status: canonical
- 역할: 기능형 CRUD 백엔드에서 플랫폼형 백엔드로 옮겨가기 위한 재설계 마스터플랜
- 언제 보는가: 백엔드 도메인 구조와 장기 방향을 잡을 때
- 주의: 현재 API 구현 설명 문서라기보다 장기 재설계 문서다

---

## F. 문서 운영 문서

### DOCUMENTATION_GOVERNANCE.md
- Status: canonical
- 역할: 문서 상태, 역할, 중복 방지, 운영 규칙을 정의하는 기준 문서
- 언제 보는가: 새 문서를 만들지, 기존 문서를 수정할지 판단할 때

### DOCUMENTATION_INDEX.md
- Status: canonical
- 역할: 전체 문서를 찾고 우선순위를 판단하는 인덱스
- 언제 보는가: 어떤 문서를 먼저 읽어야 할지 헷갈릴 때

### DOCUMENT_STATUS_MATRIX.md
- Status: canonical
- 역할: 전체 문서의 상태 분류표
- 언제 보는가: 어떤 문서가 canonical / active / reference 인지 확인할 때

---

## 3. 현재 기준 문서 요약

현재 시점에서 가장 중요한 기준 문서는 아래다.

### 프로젝트 상태 기준
- `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`

### 프론트엔드 기준
- `FRONTEND_BLUEPRINT_V1.md`
- `FRONTEND_FOUNDATION_MASTERPLAN.md`

### 백엔드 기준
- `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`

### 문서 운영 기준
- `DOCUMENTATION_GOVERNANCE.md`
- `DOCUMENTATION_INDEX.md`
- `DOCUMENT_STATUS_MATRIX.md`

### 코드-문서 정합성 확인 기준
- `CODE_DOCUMENT_ALIGNMENT_REPORT.md`

---

## 4. 문서 사용 추천 순서

### Case 1. 저장소에 처음 들어온다
1. `README.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENTATION_INDEX.md`

### Case 2. 프론트 구조를 수정하려 한다
1. `FRONTEND_BLUEPRINT_V1.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `FRONTEND_FOUNDATION_MASTERPLAN.md`
4. 필요 시 `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`
5. 필요 시 `FINAL_WEB_DESIGN.md`

### Case 3. 백엔드 구조를 수정하려 한다
1. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
2. `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
3. 필요 시 `PROJECT_SPEC.md`, `IMPLEMENTATION_PLAN.md`

### Case 4. 문서를 새로 만들지 고민 중이다
1. `DOCUMENTATION_GOVERNANCE.md`
2. `DOCUMENTATION_INDEX.md`
3. `DOCUMENT_STATUS_MATRIX.md`
4. 필요 시 `CODE_DOCUMENT_ALIGNMENT_REPORT.md`

---

## 5. 장기 정리 방향

현재는 루트 문서가 많아도 괜찮다.
다만 장기적으로는 다음 구조를 권장한다.

```text
/docs
  /project
  /product
  /frontend
  /backend
  /archive
```

단, 지금은 문서 이동보다 아래가 우선이다.
- 기준 문서 확정
- 역할/상태 정의
- 인덱스 정리
- 코드 기준 문서와 목표 문서 구분
- 중복 방지

---

## 6. 최종 정리

문서가 많을수록 중요한 것은
"삭제"보다 **기준 문서와 참고 문서를 분명히 하고, 현실 설명 문서와 목표 문서를 구분하는 것**이다.

이 인덱스는 Work Archive의 현재 문서 구조를 이해하고,
무엇을 먼저 읽고 무엇을 기준으로 개발할지 빠르게 판단하기 위한 출발점으로 사용한다.
