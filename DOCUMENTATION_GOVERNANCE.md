# DOCUMENTATION_GOVERNANCE.md

## 목적
이 문서는 Work Archive 저장소 안의 문서가 무분별하게 늘어나는 문제를 줄이고, **어떤 문서가 기준 문서인지**, **어떤 문서는 참고용인지**, **어떤 문서는 과거 기록인지**를 명확히 관리하기 위한 기준 문서다.

현재 저장소에는 프로젝트 개요, 구현 계획, 웹디자인 방향, 프론트 설계도, 프론트/백엔드 마스터플랜 등 다양한 문서가 존재한다.
문서 자체는 많아도 괜찮지만, 다음 문제가 생기면 관리가 어려워진다.

- 같은 주제를 설명하는 문서가 여러 개 존재함
- 어떤 문서가 최신 기준인지 불분명함
- 과거 문서와 현재 문서가 섞여 있음
- Codex나 협업자가 무엇을 기준으로 삼아야 하는지 헷갈림
- 문서가 늘어날수록 오히려 의사결정 비용이 커짐

이 문서는 그 문제를 해결하기 위한 **문서 관리 운영 규칙**을 정의한다.

---

## 1. 문서 관리의 기본 원칙

### 원칙 1. 문서는 많아도 되지만, 역할은 겹치면 안 된다
각 문서는 반드시 역할이 명확해야 한다.

예:
- 프로젝트 개요 문서
- 현재 상태 보고 문서
- 프론트 설계 기준 문서
- 프론트 실행 계획 문서
- 백엔드 재설계 문서

같은 주제를 여러 문서가 다룰 수는 있어도, **어떤 문서가 기준 문서인지**는 항상 분명해야 한다.

### 원칙 2. 모든 문서는 상태(Status)를 가져야 한다
문서는 다음 네 가지 상태 중 하나를 가진다.

- **canonical**: 현재 가장 중요한 기준 문서
- **active**: 현재 참고해야 하는 실사용 문서
- **reference**: 참고용 문서
- **archived**: 과거 기록 문서

### 원칙 3. 문서가 늘어나면 새 문서를 만들기 전에 먼저 기존 문서 역할을 확인한다
새 문서를 만들기 전 다음을 먼저 검토한다.

1. 기존 문서에 한 섹션 추가로 해결 가능한가?
2. 정말 별도 문서가 필요한가?
3. 새 문서가 기준 문서인지, 참고 문서인지 명확한가?

### 원칙 4. 문서의 최신 기준은 항상 인덱스에서 찾을 수 있어야 한다
어떤 문서를 먼저 읽어야 하는지, 어떤 문서가 최신 기준인지 **한 파일에서 즉시 보이게** 관리해야 한다.

이 역할은 `DOCUMENTATION_INDEX.md`가 담당한다.

---

## 2. 문서 분류 체계

현재 저장소 문서는 아래 6개 그룹으로 나눈다.

### A. 프로젝트 기본 문서
역할:
- 프로젝트 개요, 설치, 실행, 기본 구조 설명

예시:
- README.md
- PROJECT_SPEC.md
- IMPLEMENTATION_PLAN.md
- PLAN.md
- IMPLEMENT.md

### B. 현재 상태 / 보고 문서
역할:
- 지금 어디까지 왔는지 설명
- 현재 기능, 한계, 미래 계획 요약

예시:
- CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md

### C. 최종 방향 / 비전 문서
역할:
- 서비스가 궁극적으로 어떤 제품이 되어야 하는지 설명

예시:
- FINAL_WEB_DESIGN.md

### D. 설계도 / 기준 문서
역할:
- 현재 기준으로 무엇을 고정했는지 설명
- 구현 시 source of truth 역할 수행

예시:
- FRONTEND_BLUEPRINT_V1.md

### E. 실행 계획 / 마스터플랜 문서
역할:
- 어떤 순서로 제품/프론트/백엔드를 발전시킬지 설명

예시:
- COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md
- FRONTEND_FOUNDATION_MASTERPLAN.md
- BACKEND_SERVICE_REDESIGN_MASTERPLAN.md

### F. 과거/중간 단계 문서
역할:
- 의사결정 과정이나 과거 상태를 기록
- 현재 기준 문서는 아니지만 역사 추적용으로 유지

이 그룹은 지금 즉시 별도 파일로 분리하지 않더라도, 장기적으로 `archive/docs/` 또는 `docs/archive/`로 이동할 후보군이다.

---

## 3. 현재 문서 운영 규칙

### 3-1. 반드시 기준 문서를 먼저 본다
현재 기준 문서 우선순위는 다음과 같다.

#### 프론트엔드 기준 문서
1. `FRONTEND_BLUEPRINT_V1.md`
2. `FRONTEND_FOUNDATION_MASTERPLAN.md`
3. `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`
4. `FINAL_WEB_DESIGN.md`

#### 백엔드 기준 문서
1. `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md` (상태 참고)
3. `PROJECT_SPEC.md` / `IMPLEMENTATION_PLAN.md` (기초 구조 참고)

#### 프로젝트 전체 상황 파악용
1. `README.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENTATION_INDEX.md`

### 3-2. 문서를 수정할 때는 연결 문서도 같이 검토한다
예를 들어:
- 프론트 구조를 바꾸면 `FRONTEND_BLUEPRINT_V1.md`와 `FRONTEND_FOUNDATION_MASTERPLAN.md`를 같이 본다.
- 백엔드 도메인 구조를 바꾸면 `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`를 같이 업데이트한다.
- 프로젝트 큰 방향이 바뀌면 `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`도 반영한다.

### 3-3. 문서가 기준과 달라지면 방치하지 않는다
실제 구현이 문서와 달라졌다면 아래 중 하나를 바로 수행한다.
- 문서를 업데이트한다.
- 문서를 archived/reference 상태로 내린다.
- 새 기준 문서를 만들고 인덱스에서 우선순위를 교체한다.

---

## 4. 문서 파일 작성 규칙

앞으로 새 문서를 만들 때는 아래 헤더를 권장한다.

```md
# 문서명

- Status: canonical | active | reference | archived
- Owner: frontend | backend | product | project
- Purpose: 이 문서가 무엇을 위한 문서인지 한 줄 설명
- Source of Truth: yes | no
- Last updated: YYYY-MM-DD
```

이 형식을 강제하지는 않지만, 가능한 문서부터 점진적으로 적용한다.

---

## 5. 문서 중복을 줄이는 규칙

### 새 문서를 만들기 전에 확인할 것
1. 기존 문서의 섹션 추가로 해결 가능한가?
2. 이 문서가 정말 별도 파일이어야 하는가?
3. 같은 내용을 반복 설명하고 있지 않은가?
4. 새 문서가 source of truth인지 아닌지 분명한가?

### 중복이 생겼을 때 처리 원칙
- 기준 문서는 유지한다.
- 참고 문서는 인덱스에서 reference로 내린다.
- 과거 문서는 archived로 내린다.
- 문서를 바로 삭제하기보다 먼저 역할을 낮춘다.

---

## 6. 추천 문서 구조 (장기 목표)

현재는 루트 문서가 많아도 괜찮다. 다만 장기적으로는 아래 구조를 권장한다.

```text
/docs
  /project
  /product
  /frontend
  /backend
  /archive
```

예시:
- `/docs/project/README.md`
- `/docs/product/FINAL_WEB_DESIGN.md`
- `/docs/frontend/FRONTEND_BLUEPRINT_V1.md`
- `/docs/frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`
- `/docs/backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
- `/docs/archive/...`

단, 지금 당장은 대규모 이동보다 **인덱스 + 거버넌스**부터 적용하는 것이 안전하다.

---

## 7. 현재 시점에서의 실전 운영 방식

지금 당장은 다음 방식으로 운영한다.

1. 루트 문서는 유지한다.
2. `DOCUMENTATION_INDEX.md`를 기준으로 문서를 찾는다.
3. `DOCUMENTATION_GOVERNANCE.md`를 기준으로 새 문서 생성 여부를 판단한다.
4. 가장 중요한 기준 문서는 아래로 고정한다.

### 핵심 기준 문서
- 프로젝트 상태: `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
- 프론트 기준: `FRONTEND_BLUEPRINT_V1.md`
- 프론트 구조 마스터플랜: `FRONTEND_FOUNDATION_MASTERPLAN.md`
- 백엔드 구조 마스터플랜: `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
- 제품/디자인 방향: `FINAL_WEB_DESIGN.md`

---

## 8. 최종 정리

문서가 많아지는 것이 문제는 아니다.
문제가 되는 것은 다음이다.
- 어떤 문서가 최신인지 모르겠는 상태
- 역할이 겹치는 문서가 늘어나는 상태
- 과거 문서와 현재 기준 문서가 섞여 있는 상태

따라서 앞으로의 문서 관리는 다음 한 줄로 요약할 수 있다.

**"문서 수를 줄이기보다, 역할 / 상태 / 우선순위를 명확히 해서 관리한다."**

이 문서는 Work Archive 저장소의 문서 운영 기준으로 사용한다.
