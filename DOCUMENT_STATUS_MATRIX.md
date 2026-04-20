# DOCUMENT_STATUS_MATRIX.md

## 목적
이 문서는 Work Archive 저장소에 존재하는 주요 문서를

- `canonical`
- `active`
- `reference`
- `archived`

상태로 분류한 표다.

이 문서의 목적은 다음과 같다.
- 어떤 문서가 현재 기준 문서인지 빠르게 판단한다.
- 어떤 문서가 참고용인지 구분한다.
- 과거 문서와 현재 문서를 섞어 읽는 일을 줄인다.
- Codex/협업자/미래의 나 자신이 같은 문서를 두 번 해석하는 비용을 줄인다.

상태 정의와 운영 규칙은 `DOCUMENTATION_GOVERNANCE.md`를 따른다.
전체 문서 인덱스는 `DOCUMENTATION_INDEX.md`를 따른다.

---

## 1. 상태 정의 요약

### canonical
현재 가장 중요한 **기준 문서**.
실제 설계/구현/의사결정의 source of truth 역할을 한다.

### active
현재도 자주 참고해야 하는 **실사용 문서**.
기준 문서는 아닐 수 있지만, 프로젝트 운영에 계속 중요하다.

### reference
참고용 문서.
현재 구현/설계의 직접 기준은 아니지만, 과거 맥락이나 기본 사양을 이해하는 데 유용하다.

### archived
과거 기록 문서.
현재 기준이 아니며, 특별한 이유가 있을 때만 본다.

---

## 2. 현재 문서 상태 분류표

| 문서명 | 상태 | 영역 | 역할 요약 | 비고 |
|---|---|---|---|---|
| `README.md` | active | project | 프로젝트 개요, 실행 방법, 시작점 | 저장소 첫 진입 시 가장 먼저 보는 문서 |
| `PROJECT_SPEC.md` | reference | project | 초기 프로젝트 요구사항 / 기본 스펙 참고 | 현재 기준 문서는 아님 |
| `IMPLEMENTATION_PLAN.md` | reference | project | 초기 구현 계획 참고 | 과거 milestone 문맥 이해용 |
| `PLAN.md` | reference | project | 초기 단계별 검증/진행 계획 참고 | 현재 기준보다 역사 추적용 |
| `IMPLEMENT.md` | reference | project | 초기 구현 지시/흐름 참고 | 현재 기준 문서는 아님 |
| `FINAL_WEB_DESIGN.md` | active | product | 최종 제품/웹디자인 방향 문서 | 이상적 최종 방향 참고 |
| `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md` | active | product/frontend | 상용 수준 웹디자인 구현 계획 | 프론트 개선 로드맵에서 중요 |
| `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md` | canonical | project/product | 현재 상태 + 미래 계획 기준 보고서 | 프로젝트 상황 파악의 핵심 기준 |
| `FRONTEND_BLUEPRINT_V1.md` | canonical | frontend | 현재 프론트 설계 고정값 / source of truth | 프론트 구현 기준 문서 |
| `FRONTEND_FOUNDATION_MASTERPLAN.md` | canonical | frontend | 프론트 기반 구조 / 레이아웃 / 페이지 경험 분리 마스터플랜 | 실제 웹사이트형 전환 기준 |
| `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md` | canonical | backend | 기능형 CRUD 서버에서 플랫폼형 백엔드로 가기 위한 재설계 기준 | 백엔드 도메인 재설계 핵심 |
| `DOCUMENTATION_GOVERNANCE.md` | canonical | docs | 문서 운영 규칙 / 상태 정의 / 중복 방지 기준 | 문서 관리의 기준 문서 |
| `DOCUMENTATION_INDEX.md` | canonical | docs | 문서 인덱스 / 우선순위 / 읽는 순서 | 문서 탐색의 출발점 |
| `DOCUMENT_STATUS_MATRIX.md` | canonical | docs | 문서 상태 분류표 | 현재 문서 상태를 한눈에 보는 기준 |

---

## 3. 현재 가장 중요한 canonical 문서

현재 시점에서 source of truth로 간주해야 할 문서는 아래다.

### 프로젝트 상태
- `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`

### 프론트엔드
- `FRONTEND_BLUEPRINT_V1.md`
- `FRONTEND_FOUNDATION_MASTERPLAN.md`

### 백엔드
- `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`

### 문서 체계
- `DOCUMENTATION_GOVERNANCE.md`
- `DOCUMENTATION_INDEX.md`
- `DOCUMENT_STATUS_MATRIX.md`

---

## 4. active 문서

다음 문서는 canonical은 아니지만 현재도 자주 참고하는 active 문서다.

- `README.md`
- `FINAL_WEB_DESIGN.md`
- `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`

이 문서들은 제품 방향과 시작점 파악에는 중요하지만,
실제 구현 기준은 canonical 문서가 우선한다.

---

## 5. reference 문서

다음 문서는 현재 기준이 아니라 참고용이다.

- `PROJECT_SPEC.md`
- `IMPLEMENTATION_PLAN.md`
- `PLAN.md`
- `IMPLEMENT.md`

이 문서들은 삭제할 필요는 없지만,
앞으로는 **직접 source of truth처럼 사용하면 안 되는 문서**다.

필요한 경우:
- 과거 milestone 기준 확인
- 초기 프로젝트 요구사항 확인
- 예전 설계와 현재 설계 차이 확인

정도로만 사용한다.

---

## 6. archived 상태에 대한 현재 판단

현재 시점에서는 명시적으로 `archived`로 내릴 문서를 아직 만들지 않는다.

이유:
- 현재 reference 문서 수가 아직 감당 가능한 수준이다.
- 지금은 삭제/이동보다 상태 분류를 먼저 적용하는 것이 더 안전하다.
- 성급히 archived 처리하면 과거 맥락이 필요할 때 오히려 찾기 어려워질 수 있다.

다만 아래 조건 중 하나를 만족하면 이후 archived로 전환할 수 있다.
- 현재 구현/설계와 충돌하는 오래된 문서
- 더 이상 열어볼 일이 거의 없는 milestone 전용 기록
- 현재 기준과 혼동을 강하게 일으키는 문서

장기적으로는 `docs/archive/`로 이동할 후보가 될 수 있다.

---

## 7. 실전 사용 규칙

### 프론트 작업 전
반드시 우선 확인:
1. `FRONTEND_BLUEPRINT_V1.md`
2. `FRONTEND_FOUNDATION_MASTERPLAN.md`
3. 필요 시 `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`
4. 필요 시 `FINAL_WEB_DESIGN.md`

### 백엔드 작업 전
반드시 우선 확인:
1. `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. 필요 시 `PROJECT_SPEC.md`, `IMPLEMENTATION_PLAN.md`

### 프로젝트 전체 방향 확인 전
반드시 우선 확인:
1. `README.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENTATION_INDEX.md`

### 새 문서 만들기 전
반드시 우선 확인:
1. `DOCUMENTATION_GOVERNANCE.md`
2. `DOCUMENTATION_INDEX.md`
3. `DOCUMENT_STATUS_MATRIX.md`

---

## 8. 장기 정리 방향

현재는 상태 분류만 해도 충분히 큰 개선이다.
장기적으로는 아래를 고려한다.

### Step 1
현재 문서에 상태 분류를 유지한다.

### Step 2
reference 문서 중 오래된 문서를 `docs/archive/` 후보로 분류한다.

### Step 3
루트 문서를 `docs/project`, `docs/frontend`, `docs/backend`, `docs/archive` 구조로 점진 이동한다.

단, 지금 당장은 구조 이동보다 **기준 문서를 확실히 구분하는 것**이 우선이다.

---

## 9. 최종 정리

현재 Work Archive 문서 체계는 다음 원칙으로 읽으면 된다.

- `canonical`: 지금 기준으로 직접 따라야 하는 문서
- `active`: 현재도 자주 참고해야 하는 문서
- `reference`: 과거/초기 문맥 이해용 문서
- `archived`: 아직 본격 적용하지 않았지만, 장기적으로 과거 문서를 내릴 상태

가장 중요한 점은,
문서를 줄이는 것이 아니라 **무엇이 기준인지 분명하게 만드는 것**이다.

이 문서는 현재 저장소 문서 상태를 관리하기 위한 기준표로 사용한다.
