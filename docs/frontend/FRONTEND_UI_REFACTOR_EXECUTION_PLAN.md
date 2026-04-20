# FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md

## 문서 목적
이 문서는 Work Archive 프론트엔드를 **Mantine 중심의 깔끔하고 전문적인 웹 UI 시스템**으로 전환하기 위한 실제 실행 계획서다.

이 문서는 다음 질문에 답한다.
- 어떤 순서로 리팩터링을 시작해야 하는가
- 어떤 파일을 먼저 바꾸고 어떤 파일은 나중에 바꿔야 하는가
- global.css를 어떤 방식으로 줄여나가야 하는가
- 공용 컴포넌트는 무엇부터 만들어야 하는가
- 홈 / 작품 목록 / 작품 상세 / 인증 / 계정 화면을 어떤 우선순위로 재설계해야 하는가

이 문서는 비전 문서가 아니라, **실제 구현 착수용 프론트 실행 문서**다.

---

## 1. 실행 목표

이번 프론트 리팩터링의 목표는 아래 4가지를 동시에 달성하는 것이다.

1. 전역 CSS 중심 구조를 끝낸다.
2. Mantine theme + component 기반 구조로 전환한다.
3. 설명문이 많은 프로토타입형 화면을, 행동 중심의 서비스형 화면으로 바꾼다.
4. 홈 / 작품 목록 / 작품 상세의 성격을 시각적으로 분명히 분리한다.

---

## 2. 결과물 정의

리팩터링 완료 후 기대 결과물은 다음과 같다.

### 구조 결과물
- `MantineProvider`와 `theme.ts`가 스타일 기준의 중심이 된다.
- `global.css`는 최소 전역 스타일만 남는다.
- 공용 UI 컴포넌트가 생긴다.
- 페이지 전용 시각 규칙은 CSS보다 컴포넌트 조합으로 해결한다.

### 화면 결과물
- 홈은 설명형이 아니라 허브형 화면이 된다.
- 작품 목록은 관리형 화면이 된다.
- 작품 상세는 감상 중심 화면이 된다.
- 인증/계정은 더 단정하고 신뢰감 있는 화면이 된다.

### 운영 결과물
- 신규 기능 추가 시 global.css를 먼저 건드리지 않아도 된다.
- theme와 공용 UI를 재사용하는 방식이 기본 개발 흐름이 된다.

---

## 3. 리팩터링 범위

### 포함 범위
- 앱 스타일 인프라
- App Shell
- 공용 UI 컴포넌트
- 홈
- 작품 목록
- 작품 상세
- 작품 추가 / 수정
- 인증 화면
- 계정 / 동기화 화면

### 제외 범위
이번 문서에서는 아래는 직접 구현 범위에 넣지 않는다.
- 백엔드 API 구조 변경
- 도메인 모델 재설계
- canonical catalog UI 본격 구현
- 티어 보드 / 커뮤니티 기능 자체 완성

즉, 이번 리팩터링은 **기존 프론트의 UI 체계와 화면 구조 개선**에 집중한다.

---

## 4. 핵심 원칙

### 4-1. 라이브러리 우선
- 공통 UI는 Mantine 우선
- 직접 CSS는 최소화
- theme와 component 조합으로 해결 가능한 문제는 CSS로 다시 만들지 않는다

### 4-2. 공용 컴포넌트 우선
- 페이지마다 비슷한 패턴을 새로 짜지 않는다
- 먼저 공용 UI를 만든 뒤 페이지에 적용한다

### 4-3. 카피 축소
- 설명문을 줄인다
- 제목 / 상태 / CTA 중심으로 재구성한다
- 화면이 스스로 말하게 하고, 설명문으로 보정하지 않는다

### 4-4. 페이지 성격 분리
- 홈은 허브
- 작품 목록은 관리
- 상세는 감상
- 인증은 입력 집중
- 계정은 관리형

---

## 5. 최종 파일 구조 목표

```text
apps/web/src/
  app/
    App.tsx
    main.tsx
    theme.ts
    styles/
      app-shell.css
      media.css
  shared/
    ui/
      AppPage.tsx
      PageHeader.tsx
      SectionCard.tsx
      StatCard.tsx
      EmptyState.tsx
      Poster.tsx
      ActionBar.tsx
      FilterBar.tsx
```

설명:
- `theme.ts`: 시각 시스템 기준
- `app-shell.css`: body, root, 최소 배경
- `media.css`: 포스터 / 썸네일 보정
- `shared/ui/*`: 페이지에서 재사용되는 기본 UI 조합

---

## 6. 기존 CSS 정리 전략

### 6-1. 즉시 삭제하지 않는다
기존 `global.css`는 한 번에 지우지 않는다.
먼저 Mantine와 공용 컴포넌트로 대체 가능한 부분을 이동시킨 뒤, 단계적으로 제거한다.

### 6-2. 분류 기준
기존 global.css 규칙은 아래 기준으로 나눈다.

#### A. theme로 이동
- 색상 토큰
- radius
- spacing 감각
- typography 기준
- shadow 기준

#### B. Mantine component로 대체
- button
- input / textarea / select
- badge / tag / pill
- panel / card / empty state / stat tile
- layout grid / section header / button row

#### C. 최소 CSS로 유지
- `body`, `#root`
- 페이지 배경
- poster aspect ratio / fallback
- 극히 예외적인 스타일

### 6-3. 최종 상태
최종적으로 `global.css`는 제거하거나, 아래 2개 파일로 축소한다.
- `app-shell.css`
- `media.css`

---

## 7. 공용 UI 컴포넌트 1차 목록

### 7-1. AppPage
역할:
- 페이지 폭 제한
- 기본 vertical spacing
- 페이지 variant 지원

variant 예시:
- home
- workspace
- detail
- auth
- account

### 7-2. PageHeader
역할:
- title
- optional description
- optional actions
- optional meta

원칙:
- description은 기본값이 아니다
- title과 action을 먼저 보여준다

### 7-3. SectionCard
역할:
- `Paper` / `Card` 기반의 공통 섹션 래퍼
- padding / radius / border / background 통일

### 7-4. StatCard
역할:
- 수치 + 레이블 + 짧은 설명

원칙:
- 긴 설명 금지
- CTA 필요 시 카드 전체 클릭 또는 하단 링크

### 7-5. EmptyState
역할:
- 제목
- 짧은 이유
- CTA

### 7-6. Poster
역할:
- 썸네일 / 포스터 표시
- fallback 처리
- aspect ratio 유지

### 7-7. ActionBar
역할:
- 상단 버튼 묶음
- 페이지별 CTA 정렬 통일

### 7-8. FilterBar
역할:
- 검색 / 필터 / 정렬 / 뷰모드 / 상태칩 정리

---

## 8. 단계별 실행 계획

## Phase 1. 스타일 인프라 교체

### 목표
Mantine가 스타일 기준의 중심이 되게 만든다.

### 작업
1. Mantine 설치
2. `main.tsx`에 Mantine 스타일 import
3. `MantineProvider` 연결
4. `Notifications` 연결
5. `theme.ts` 생성
6. `app-shell.css` 생성
7. `media.css` 생성
8. 기존 `global.css`는 당장 제거하지 않고 유지

### 산출물
- `apps/web/src/app/theme.ts`
- `apps/web/src/app/styles/app-shell.css`
- `apps/web/src/app/styles/media.css`
- 수정된 `main.tsx`

### 완료 기준
- 앱이 Mantine provider 아래에서 렌더링된다
- 색/폰트/radius 기준이 theme에 잡힌다
- 앱이 기존보다 크게 깨지지 않고 실행된다

---

## Phase 2. 공용 UI 컴포넌트 1차 구축

### 목표
페이지 리팩터링 전에 공용 부품을 만든다.

### 작업
1. `AppPage`
2. `PageHeader`
3. `SectionCard`
4. `StatCard`
5. `EmptyState`
6. `Poster`
7. `ActionBar`

### 파일 예시
- `shared/ui/AppPage.tsx`
- `shared/ui/PageHeader.tsx`
- `shared/ui/SectionCard.tsx`
- `shared/ui/StatCard.tsx`
- `shared/ui/EmptyState.tsx`
- `shared/ui/Poster.tsx`
- `shared/ui/ActionBar.tsx`

### 완료 기준
- 새 페이지를 만들 때 전역 CSS 클래스를 먼저 찾지 않아도 된다
- 공용 컴포넌트만으로 기본 섹션과 빈 상태를 구성할 수 있다

---

## Phase 3. App Shell 리팩터링

### 목표
현재 레이아웃의 설명성 UI를 줄이고, Mantine AppShell 기반 구조로 전환한다.

### 대상 파일
- `app/layouts/MainProductLayout.tsx`
- `app/layouts/AuthLayout.tsx`
- `app/layouts/AccountLayout.tsx`
- `app/layouts/MinimalLayout.tsx`

### 작업
1. `MainProductLayout`을 Mantine `AppShell` 기반으로 재작성
2. 브랜드 / 주 네비 / 핵심 액션 재정렬
3. 세션 카드의 장문 설명 축소
4. layout 관련 전역 클래스 의존 제거

### 완료 기준
- 메인 헤더가 더 단순하고 안정적으로 보인다
- 전역 헤더에 설명문이 과도하게 남아있지 않다
- 레이아웃 전용 CSS 대부분이 제거된다

---

## Phase 4. 홈 리디자인

### 목표
홈을 설명형 화면에서 허브형 화면으로 바꾼다.

### 대상 파일
- `features/home/pages/HomePage.tsx`

### 유지할 것
- 검색 또는 빠른 추가 진입
- 핵심 통계 4개
- 최근 기록 6개

### 제거/축소할 것
- 장문의 환영 메시지
- 여러 장의 안내 카드
- hint badge 남발
- 같은 뜻을 반복하는 설명 블록

### 새 구조
1. 상단 검색 / 빠른 추가
2. 통계 카드 4개
3. 최근 기록 섹션

### 완료 기준
- 홈 첫 화면에서 해야 할 일이 즉시 보인다
- 텍스트보다 행동이 먼저 보인다
- 화면 밀도가 줄고 전문적으로 보인다

---

## Phase 5. 작품 목록 리팩터링

### 목표
작품 목록을 관리 워크스페이스답게 만든다.

### 대상 파일
- `features/works/pages/WorksListPage.tsx`
- `features/works/components/WorksToolbar.tsx`
- `features/works/components/WorksList.tsx`
- `features/works/components/WorksTrashList.tsx`

### 작업
1. 필터/정렬/검색을 `FilterBar` 중심으로 재구성
2. 리스트 row를 Mantine `Paper` + `Group` 중심으로 단순화
3. empty state를 `EmptyState`로 교체
4. 휴지통 surface의 장문 설명 축소
5. quick update를 더 건조하고 단정하게 표현

### 완료 기준
- 목록이 관리 화면처럼 보인다
- 시각적 장식보다 스캔성과 조작성이 좋아진다
- 휴지통/빈 상태/오류 상태가 짧고 명확해진다

---

## Phase 6. 작품 상세 리팩터링

### 목표
상세 화면을 감상 중심 UI로 정리한다.

### 대상 파일
- `features/works/pages/WorkDetailPage.tsx`
- `features/works/components/WorkDetailPanel.tsx`

### 작업
1. 상단 hero를 작품 정보 중심으로 재정렬
2. 상태 / 별점 / 즐겨찾기 / 액션을 더 압축적으로 배치
3. 한줄평과 리뷰를 더 위로 끌어올림
4. 빠른 수정 영역의 설명문 축소
5. 섹션 카드 중첩 최소화

### 완료 기준
- 작품과 감상 기록이 먼저 보인다
- 편집 안내문보다 실제 기록이 중심에 온다
- 시각적으로 더 전문적이고 안정적이다

---

## Phase 7. 작품 추가 / 수정 리팩터링

### 목표
검색 중심 flow와 입력 집중도를 높인다.

### 대상 파일
- `features/works/pages/WorkCreatePage.tsx`
- `features/works/pages/WorkEditPage.tsx`
- 관련 form component

### 작업
1. 단계 UI를 단순화
2. 후보 카드의 설명문 축소
3. 자동 채움 검토와 개인 기록 입력을 시각적으로 분리
4. review / metadata / thumbnail preview 구조 정리

### 완료 기준
- 입력 피로가 줄고, flow가 더 빠르게 느껴진다
- 시각적 혼잡이 줄어든다

---

## Phase 8. 인증 / 계정 / 동기화 리팩터링

### 목표
신뢰감 있고 차분한 관리형 UI로 정리한다.

### 대상 파일
- `features/auth/pages/LoginPage.tsx`
- `features/auth/pages/RegisterPage.tsx`
- `features/profile/pages/*`
- `features/sync/pages/SyncPage.tsx`

### 작업
1. 인증 화면의 feature card 과다 여부 점검
2. 계정 화면을 설정형 UI로 단순화
3. 동기화 상태 화면에서 중복 설명 제거
4. 상태 / 수치 / CTA 중심으로 재배치

### 완료 기준
- 인증 화면이 설명 페이지처럼 보이지 않는다
- 계정/동기화가 관리형 UI처럼 보인다

---

## 9. 페이지별 체크리스트

### 홈 체크리스트
- [ ] 상단에서 바로 검색 가능
- [ ] 빠른 추가 CTA가 분명함
- [ ] 통계 카드가 4개 내외로 유지됨
- [ ] 최근 기록이 핵심 정보만 보여줌
- [ ] 장문의 안내 카드가 없음

### 작품 목록 체크리스트
- [ ] 필터/정렬/검색이 한 번에 보임
- [ ] 리스트 스캔이 쉬움
- [ ] 빠른 수정이 복잡하지 않음
- [ ] empty state가 짧고 명확함

### 작품 상세 체크리스트
- [ ] 제목/상태/별점/액션이 상단에 명확함
- [ ] 한줄평/리뷰가 주인공임
- [ ] 편집 안내가 과하지 않음

### 인증 체크리스트
- [ ] 입력 집중도가 높음
- [ ] 과도한 홍보 문구가 없음
- [ ] 오류/성공 상태가 명확함

---

## 10. 개발 규칙

### 10-1. 새 UI를 만들 때
아래 순서로 판단한다.
1. Mantine 기본 컴포넌트로 가능한가
2. shared/ui 공용 컴포넌트로 해결 가능한가
3. theme override로 해결 가능한가
4. 그래도 안 되면 최소 CSS를 추가한다

### 10-2. 금지 규칙
- global.css에 새 페이지 스타일 추가 금지
- 같은 역할의 카드/헤더/빈 상태를 페이지마다 새로 작성 금지
- 설명문으로 UX를 보정하는 패턴 금지

### 10-3. 리뷰 기준
PR 또는 작업 리뷰 시 아래를 점검한다.
- 이 UI는 공용 컴포넌트로 뽑을 수 없는가
- 이 설명문은 정말 필요한가
- 이 카드가 실제로 역할이 분명한가
- 이 스타일은 theme/component로 옮길 수 없는가

---

## 11. 완료 판정 기준

### 구조 기준
- theme가 시각 시스템 기준 역할을 한다
- global.css가 최소화되었다
- 공용 UI 컴포넌트가 도입되었다

### 화면 기준
- 홈이 허브로 보인다
- 작품 목록이 관리 화면으로 보인다
- 작품 상세가 감상 화면으로 보인다
- 인증/계정 화면이 단정하고 전문적으로 보인다

### 카피 기준
- 장문 설명이 크게 줄었다
- 같은 정보를 반복하는 UI가 사라졌다
- 버튼/상태/숫자가 더 먼저 보인다

---

## 12. 최종 결론

이번 프론트 리팩터링은 단순한 스타일 교체가 아니다.

핵심은,
- global.css 중심 구조를 끝내고
- Mantine theme + shared UI 중심 구조로 전환하며
- 설명이 많은 프로토타입형 화면을
- 깔끔하고 전문적인 서비스형 화면으로 바꾸는 것

이다.

이 문서는 그 전환을 실제로 시작하기 위한 공식 실행 계획서로 사용한다.
