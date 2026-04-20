# CODE_DOCUMENT_ALIGNMENT_REPORT.md

## 목적
이 문서는 Work Archive의 **실제 코드 상태**와 **현재 문서들**을 비교해서,

- 어떤 문서는 실제 코드와 잘 맞는지
- 어떤 문서는 코드보다 앞서 있는지
- 어떤 문서는 업데이트가 필요한지
- 문서를 어떻게 해석해야 하는지

를 정리한 정합성 보고서다.

이 문서의 핵심 목적은 문서를 줄이는 것이 아니라,
**"현재 코드 기준 문서"와 "미래 방향 문서"를 구분해서 읽게 만드는 것**이다.

---

## 1. 비교 기준

이번 비교는 주로 아래 실제 코드/문서를 기준으로 했다.

### 코드 기준
- 프론트 라우트 구조
- 메인 앱 셸 구조
- 홈 화면
- 작품 목록/휴지통
- Quick Add 흐름
- API 모듈 구조
- Prisma 스키마

### 문서 기준
- `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
- `FRONTEND_BLUEPRINT_V1.md`
- `FRONTEND_FOUNDATION_MASTERPLAN.md`
- `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
- `FINAL_WEB_DESIGN.md`
- `DOCUMENTATION_INDEX.md`
- `DOCUMENT_STATUS_MATRIX.md`

---

## 2. 문서와 코드가 잘 맞는 부분

### 2-1. FRONTEND_BLUEPRINT_V1.md
이 문서는 현재 프론트 설계 방향과 실제 코드가 비교적 잘 맞는 편이다.

특히 아래 항목은 실제 코드와 잘 연결된다.
- Home이 시작점이라는 방향
- 작품 목록의 관리형 UX 방향
- 작품 추가를 검색/선택/자동 채움 검토 구조로 가져간다는 방향
- 티어 보드를 별도 기능으로 본다는 결정
- 커뮤니티는 개인 기록의 보조 레이어라는 방향

즉, 이 문서는 여전히 프론트 구현의 source of truth로 유지해도 된다.

---

### 2-2. BACKEND_SERVICE_REDESIGN_MASTERPLAN.md
이 문서는 현재 코드를 설명하는 문서라기보다,
현재 백엔드의 한계를 정확히 짚는 재설계 문서다.

실제 Prisma 구조와 비교하면,
현재 `Work` 모델에 공용 작품 데이터와 개인 기록 데이터가 함께 들어 있다는 점을 정확히 문제로 보고 있다.
이 문서는 코드와 충돌하지 않고, 오히려 현재 구조의 한계를 잘 설명한다.

즉, 이 문서는 “미래 백엔드 기준 문서”로 적절하다.

---

### 2-3. DOCUMENTATION_GOVERNANCE.md / DOCUMENTATION_INDEX.md / DOCUMENT_STATUS_MATRIX.md
이 세 문서는 문서 관리 체계를 설명하는 문서이므로,
코드와 직접 비교하는 대상이라기보다 **문서를 해석하는 기준 문서**다.

현재 역할은 적절하다.

---

## 3. 문서가 코드보다 앞서 있는 부분

### 3-1. FRONTEND_FOUNDATION_MASTERPLAN.md
이 문서는 방향은 맞지만, 실제 코드보다 앞서 있다.

특히 다음 내용은 아직 코드에 완전히 반영되지 않았다.
- Main / Auth / Account / Minimal layout의 명확한 분리
- 로그인/회원가입이 완전한 독립 인증 페이지 경험이 되는 구조
- 프로필/설정/동기화가 account layout 아래에서 별도 맥락으로 분리되는 구조

즉, 이 문서는 **현재 상태 문서가 아니라 프론트 기반 재설계 목표 문서**로 읽어야 한다.

---

### 3-2. FINAL_WEB_DESIGN.md
이 문서도 방향성과 비전 문서로는 좋지만,
실제 코드보다 앞서 있는 부분이 있다.

특히 아래는 아직 구현보다 이상적 방향에 가깝다.
- 완성된 상용형 IA
- 성숙한 Home / Insights / Profile / Community 경험
- 전체 제품의 완성형 UI 시스템

즉, 이 문서는 현재 구현 상태를 설명하는 문서가 아니라,
**최종 지향점 문서**로 읽어야 한다.

---

### 3-3. COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md
이 문서도 실제 구현보다는 앞으로의 프론트 확장과 상용화 과정을 설명하는 계획 문서다.

현재 코드와 충돌하진 않지만,
지금 구현 상태를 그대로 설명한다고 보면 안 된다.

즉,
- 현재 상태 확인용 문서가 아니라
- 개선 로드맵 문서

로 읽는 것이 맞다.

---

## 4. 실제 코드보다 뒤처져 있었던 문서

### 4-1. CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md
이 문서는 이전 버전에서 실제 코드보다 뒤처진 부분이 있었다.

예를 들어 과거에는 다음과 같은 문제가 있었다.
- Home이 아직 시작점이 아닌 것처럼 보이던 표현
- Sync가 아직 상위 네비게이션에서 강하게 노출되는 것처럼 보이던 표현
- Quick Add와 휴지통, 작품 상세/리뷰 흐름의 최근 개선이 충분히 반영되지 않던 점
- 프론트가 아직 더 초기 단계처럼 읽히던 점

이번 최적화에서는 이 문서를 **현재 실제 코드 상태에 맞게 갱신**했다.

지금은 이 문서를 다음처럼 읽으면 된다.
- 현재 구현 상태를 설명하는 기준 보고서
- 현재 코드와 가장 밀접한 상태 문서
- 미래 계획도 함께 담지만, 현실 구현 수준을 먼저 설명하는 문서

---

## 5. 현재 코드 기준으로 가장 신뢰할 문서

### 5-1. 현재 상태를 알고 싶을 때
가장 먼저 봐야 하는 문서:
1. `README.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `DOCUMENTATION_INDEX.md`

### 5-2. 프론트 구현 기준이 필요할 때
가장 먼저 봐야 하는 문서:
1. `FRONTEND_BLUEPRINT_V1.md`
2. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
3. `FRONTEND_FOUNDATION_MASTERPLAN.md`

설명:
- `FRONTEND_BLUEPRINT_V1.md`는 현재 고정 설계 기준
- `CURRENT_STATUS...`는 실제 코드 상태
- `FRONTEND_FOUNDATION...`은 앞으로의 구조 목표

### 5-3. 백엔드 방향을 알고 싶을 때
가장 먼저 봐야 하는 문서:
1. `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
2. `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`

설명:
- 현재 API 구조를 보려면 상태 보고서
- 장기 재설계 방향을 보려면 백엔드 마스터플랜

---

## 6. 문서 최적화 결과

이번 비교를 통해 문서 체계를 다음처럼 해석하도록 최적화했다.

### 현재 코드 기준 문서
- `README.md`
- `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
- `FRONTEND_BLUEPRINT_V1.md`

### 현재 + 미래 연결 문서
- `FRONTEND_FOUNDATION_MASTERPLAN.md`
- `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`

### 미래 비전 / 상위 방향 문서
- `FINAL_WEB_DESIGN.md`
- `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`

즉, 문서를 볼 때 가장 중요한 것은
**"이 문서가 현실을 설명하는가, 아니면 목표를 설명하는가"**를 구분하는 것이다.

---

## 7. 앞으로의 운영 권장 사항

### 권장 사항 1
현재 상태 보고서는 실제 코드 변경에 맞춰 가장 먼저 갱신한다.

### 권장 사항 2
마스터플랜 문서는 코드보다 앞서 있을 수 있음을 문서 인덱스에서 계속 명시한다.

### 권장 사항 3
Codex 프롬프트를 만들 때는 아래 순서로 읽는다.
- 현재 상태: `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
- 현재 프론트 기준: `FRONTEND_BLUEPRINT_V1.md`
- 현재 프론트 목표 구조: `FRONTEND_FOUNDATION_MASTERPLAN.md`
- 백엔드 장기 구조: `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`

### 권장 사항 4
향후 문서가 더 늘어나면,
현재 상태 설명 문서와 미래 방향 문서를 섞지 않도록 계속 분리 유지한다.

---

## 8. 최종 정리

현재 Work Archive 문서 체계는 크게 두 종류로 나뉜다.

### A. 현재 코드와 가까운 문서
- `README.md`
- `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`
- `FRONTEND_BLUEPRINT_V1.md`

### B. 현재 코드보다 앞선 목표/재설계 문서
- `FRONTEND_FOUNDATION_MASTERPLAN.md`
- `BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`
- `FINAL_WEB_DESIGN.md`
- `COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`

이 구분만 분명하면, 문서가 많아도 혼란은 크게 줄어든다.

이번 최적화의 핵심은 다음 한 줄로 요약할 수 있다.

**"현재 문서를 코드 기준 문서와 목표 문서로 분리해서 읽게 만든다."**

이 문서는 이후 문서 정합성을 점검할 때 기준 보고서로 사용한다.
