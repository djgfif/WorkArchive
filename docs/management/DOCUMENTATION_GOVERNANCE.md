# DOCUMENTATION_GOVERNANCE.md

## 목적
이 문서는 Work Archive 저장소의 문서를 어떻게 배치하고, 어떤 문서를 기준으로 읽고, 어떤 문서를 reference나 archive로 내릴지 판단하는 운영 기준이다.

이번 구조 정리 이후 문서의 기본 원칙은 다음과 같다.
- 실행과 개발 시작점은 루트 [`README.md`](../../README.md)에 둔다.
- 설계, 계획, 보고, 거버넌스 문서는 `docs/` 아래의 주제별 폴더에 둔다.
- 문서 수를 줄이기보다 역할과 상태를 명확히 관리한다.

---

## 1. 기본 원칙

### 원칙 1. 문서는 역할이 겹치면 안 된다
같은 주제를 여러 문서가 다뤄도 괜찮지만, 아래는 반드시 분명해야 한다.
- 현재 코드 현실을 설명하는 문서인가
- 현재 따라야 할 기준 문서인가
- 앞으로의 목표 구조를 설명하는 문서인가
- 과거 맥락 보존용 문서인가

### 원칙 2. 문서는 위치와 상태가 함께 설명되어야 한다
문서의 역할은 제목만으로 판단하지 않는다.
- 위치: 어느 폴더에 있는가
- 상태: canonical / active / reference / archived 중 무엇인가
- 해석 방식: current reality / target vision / historical reference 중 무엇인가

### 원칙 3. 새 문서를 만들기 전에 기존 문서와 폴더를 먼저 확인한다
새 문서를 만들기 전에 아래를 확인한다.
1. 기존 문서에 섹션 추가로 해결 가능한가
2. 이미 같은 역할을 가진 문서가 있는가
3. 어느 폴더에 들어가야 하는가
4. status와 source-of-truth 성격이 분명한가

### 원칙 4. 인덱스와 상태표가 항상 최신이어야 한다
문서 경로, 역할, 우선순위가 바뀌면 아래 문서를 같이 갱신한다.
- [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
- [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
- 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

### 원칙 5. 삭제보다 이동과 재링크를 먼저 고려한다
이번 저장소의 문서 운영은 역사 보존을 중시한다.
- 의미가 남아 있으면 우선 적절한 폴더로 이동한다
- 더 이상 기준 문서가 아니면 status를 낮춘다
- archive는 충분히 안전할 때만 사용한다

---

## 2. 폴더 구조 기준

문서는 아래 구조를 기준으로 관리한다.

- [`docs/project/`](../project/README.md)
  - 현재 상태 보고
  - 프로젝트 맥락
  - 아직 archive로 내리기 이른 과거 계획 문서
- [`docs/product/`](../product/README.md)
  - 제품 방향
  - 웹 UX 비전
  - 상용화 디자인 로드맵
- [`docs/frontend/`](../frontend/README.md)
  - 현재 프론트 기준 설계
  - 프론트 목표 구조와 레이아웃 재정의
- [`docs/backend/`](../backend/README.md)
  - 백엔드 도메인 재설계와 장기 구조 기준
- [`docs/management/`](./README.md)
  - 문서 탐색
  - 상태 관리
  - 거버넌스
  - 코드-문서 정합성 해석
- [`docs/archive/`](../archive/README.md)
  - 명확히 superseded 된 문서의 보관 영역

루트에 새 설계/계획 문서를 두는 것은 기본적으로 금지한다. 루트는 [`README.md`](../../README.md)와 운영성 파일 중심으로 유지한다.

---

## 3. Status 정의

### canonical
현재 가장 중요한 기준 문서다.

주의:
- canonical은 항상 "현재 코드 현실"만 뜻하지 않는다.
- 이 저장소에서는 "현재 따라야 할 기준"과 "목표 구조의 기준" 둘 다 canonical일 수 있다.

예:
- 현재 프론트 기준: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- 현재 백엔드 목표 구조 기준: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

### active
현재 자주 참고하지만 canonical은 아닌 문서다.

예:
- 루트 시작점: [`../../README.md`](../../README.md)
- 제품 비전: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- 정합성 보고서: [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

### reference
과거 맥락, 초기 요구사항, 초기 계획을 이해하는 데 쓰는 문서다.

예:
- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)
- [`../project/PLAN.md`](../project/PLAN.md)
- [`../project/IMPLEMENT.md`](../project/IMPLEMENT.md)

### archived
현재 기준에서 명확히 내려온 과거 문서다.

현재는 archive 폴더만 만들고, 실제 문서 이동은 보수적으로 진행한다.

---

## 4. 현재 Source Of Truth 규칙

### 현재 코드 현실
가장 먼저 봐야 하는 문서:
- [`../../README.md`](../../README.md)
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

역할:
- README는 실행과 운영 시작점
- Current Status Report는 현재 구현 현실과 단기 계획의 기준 보고서

### 현재 프론트 기준
가장 중요한 문서:
- [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)

보조 문서:
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)

해석:
- Blueprint는 현재 프론트 canonical
- Foundation Masterplan은 목표 구조 canonical

### 현재 백엔드 기준
가장 중요한 문서:
- [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

보조 문서:
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
- [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md)
- [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)

해석:
- Current Status Report는 현재 API 현실 참고
- Backend Masterplan은 장기 구조 기준

### 현재 제품 방향
현재 구현된 제품 현실:
- [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

미래 제품 비전과 로드맵:
- [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)
- [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)

주의:
- 현재 별도의 canonical product spec를 새로 만들지 않는다.
- 현재 제품 현실은 project 문서가, 미래 비전은 product 문서가 담당한다.

---

## 5. 작업별 읽는 순서

### 저장소에 처음 들어왔을 때
1. [`../../README.md`](../../README.md)
2. [`../README.md`](../README.md)
3. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
4. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

### 프론트 작업 전
1. [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
4. 필요 시 [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
5. 필요 시 [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md)

### 백엔드 작업 전
1. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
2. [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
3. 필요 시 [`../project/PROJECT_SPEC.md`](../project/PROJECT_SPEC.md), [`../project/IMPLEMENTATION_PLAN.md`](../project/IMPLEMENTATION_PLAN.md)

### 문서를 추가하거나 재배치하기 전
1. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
2. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
3. [`DOCUMENTATION_GOVERNANCE.md`](./DOCUMENTATION_GOVERNANCE.md)
4. 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)

---

## 6. 문서 수정 규칙

### 경로를 바꾸면 링크도 같이 바꾼다
문서를 이동하거나 이름을 바꾸면 다음을 반드시 확인한다.
- 같은 폴더 README
- [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
- [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)
- 루트 [`README.md`](../../README.md)
- 관련 설계/계획 문서의 상대 링크

### 의미가 바뀌면 status와 설명도 같이 바꾼다
예:
- 더 이상 기준 문서가 아니면 canonical에서 active/reference로 내린다
- 현재 코드를 설명하지 못하면 alignment report에 반영한다

### 연결 문서는 함께 검토한다
- 프론트 구조 변경 시: [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md), [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md)
- 백엔드 도메인 구조 변경 시: [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)
- 제품 구조 변경 시: [`../product/FINAL_WEB_DESIGN.md`](../product/FINAL_WEB_DESIGN.md), [`../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](../product/COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- 현재 구현 상태 변경 시: [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)

---

## 7. Archive 운영 규칙

문서를 archive로 이동하려면 아래 조건 중 하나 이상이 충족되어야 한다.
- 대체 기준 문서가 명확히 존재한다
- 현재 구현/설계와 충돌해 혼동을 유발한다
- 다시 읽을 필요가 거의 없는 milestone 전용 기록이다

archive로 이동할 때는 다음을 함께 수행한다.
1. [`../archive/README.md`](../archive/README.md) 기준에 맞는지 확인
2. [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)에 위치 변경 반영
3. [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md)에 status 변경 반영
4. 필요한 경우 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)에 해석 방식 변경 반영

---

## 8. 새 문서 생성 체크리스트

새 문서를 만들기 전에 아래 질문에 모두 답할 수 있어야 한다.
1. 왜 기존 문서의 섹션 추가로 해결되지 않는가
2. 어느 폴더에 들어가야 하는가
3. status는 무엇인가
4. current reality / target vision / historical reference 중 무엇인가
5. index와 matrix에 어떤 항목을 추가해야 하는가

---

## 9. 최종 정리

이 저장소의 문서 운영 원칙은 한 줄로 요약하면 다음과 같다.

**문서를 줄이는 대신, 위치와 상태와 해석 방식을 명확히 관리한다.**
