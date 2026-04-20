# FINAL_WEB_DESIGN.md

## 목적
이 문서는 Work Archive의 최종 웹 디자인 방향을 정의한다. 단순히 화면을 예쁘게 만드는 것이 아니라, **유저 편의성, 확장성, 상용 서비스 수준의 일관성**을 모두 만족하는 제품 디자인 기준 문서다.

이 문서는 아래 목적을 가진다.
- 제품의 비주얼 방향을 일관되게 유지한다.
- 화면별 UX 우선순위를 명확히 한다.
- 프론트엔드 구현 시 공통 디자인 시스템 기준으로 사용한다.
- 이후 공유 기능, 통계, 인증, 배포형 서비스로 확장할 때 기준점으로 사용한다.

---

## 1. 제품 포지셔닝

### 제품 정의
Work Archive는 단순한 감상 기록장이 아니라, **개인의 감상 이력과 취향을 구조화하고 보여주는 취향 아카이브 플랫폼**이다.

### 핵심 사용자 가치
1. 빠르게 기록할 수 있다.
2. 내 취향을 구조적으로 정리할 수 있다.
3. 내 라이브러리를 보기 좋게 관리할 수 있다.
4. 나중에 취향 분석과 공유까지 확장 가능하다.

### 디자인 철학
- Content First: 작품과 개인 기록이 주인공이다.
- Fast First: 기록과 탐색은 빠르게 끝나야 한다.
- Personal First: 내 취향과 내 데이터가 중심이다.
- Premium Dark Archive: 차분하고 고급스러운 다크 테마를 유지한다.

---

## 2. 브랜드 및 비주얼 방향

### 브랜드 톤
- 프리미엄
- 차분함
- 개인화
- 데이터 기반
- 서브컬처 친화적이지만 유치하지 않음

### 비주얼 키워드
- Dark theme
- Glass surface
- Soft blue / violet accents
- Large content cards
- Spacious layout
- Strong content hierarchy

### 피해야 할 것
- 과한 네온/사이버펑크 느낌
- 과도한 장식적 그래픽
- 관리자 툴처럼 보이는 건조한 레이아웃
- 지나치게 밝은 라이트 테마 중심 구성
- 서브컬처 특유의 과한 귀여움/오타쿠스러움

---

## 3. 정보 구조 (IA)

### 최상위 네비게이션
- Discover
- Library
- Activity
- Insights
- Profile
- Settings

### 보조 기능
- Sync
- Search
- Quick Add

### 라우트 방향
- `/` → Discover / Dashboard
- `/works` → Library
- `/works/new` → Quick Add / Full Add
- `/works/:id` → Work Detail
- `/works/:id/edit` → Edit
- `/activity` → 최근 기록/상태 변경/리뷰 활동
- `/insights` → 통계/취향 분석
- `/profile` → 내 공개 페이지
- `/settings` → 설정
- `/sync` → 동기화 상태 및 재시도

---

## 4. 핵심 사용자 플로우

### 플로우 1. 초고속 작품 추가
1. 검색창 클릭
2. 제목 입력
3. 자동완성 결과 선택
4. 상태/별점/한줄평 입력
5. 저장

목표: **5초 내 등록 가능**

### 플로우 2. 라이브러리 탐색
1. Library 진입
2. 필터/정렬 선택
3. 카드 클릭
4. 상세 보기 또는 수정

목표: **검색과 탐색이 빠르고 직관적일 것**

### 플로우 3. 취향 확인
1. Insights 진입
2. 장르/평점/활동 추이 확인
3. 프로필 또는 리스트로 이동

목표: **기록된 데이터가 의미 있게 보일 것**

### 플로우 4. 동기화 확인
1. Sync 또는 상태 배지 확인
2. Queue 확인
3. 수동 Sync 실행
4. 성공/실패/충돌 여부 확인

목표: **로컬 우선 구조가 사용자에게도 이해 가능할 것**

---

## 5. 화면별 최종 설계

## 5-1. Discover / Home

### 목적
- 제품 가치 전달
- 바로 기록하도록 유도
- 최근 활동 및 요약 정보 제공

### 섹션 구성
1. Hero Search Area
   - 검색창
   - Quick Add CTA
   - 서비스 한 줄 소개
2. Continue / Recent Section
   - 최근 기록한 작품 카드
   - 이어서 보기/수정하기
3. Stats Summary
   - 총 기록 수
   - 이번 달 기록 수
   - 평균 별점
4. Recent Activity
   - 최근 추가/수정/리뷰 내역

### 핵심 UX 포인트
- 검색창은 항상 시각적으로 가장 먼저 보이게 한다.
- Quick Add 버튼은 상시 노출한다.
- 첫 화면은 텍스트보다 행동 유도 중심으로 설계한다.

---

## 5-2. Library

### 목적
- 모든 작품을 효율적으로 탐색/관리
- 헤비 유저도 빠르게 접근 가능

### 레이아웃
- 좌측: 필터 패널
- 우측 상단: 검색, 정렬, 보기 방식 토글
- 우측 본문: 작품 카드 또는 리스트

### 필터 항목
- Type
- Status
- Genre
- Rating Range
- Tier
- Favorite

### 보기 방식
1. Grid View
   - 기본 뷰
   - 표지 중심
2. Compact View
   - 정보 밀도 높음
   - 헤비 유저용
3. List View
   - 관리/수정 중심

### 작품 카드 필수 요소
- 썸네일
- 제목
- 타입
- 상태
- 별점
- 짧은 감상 텍스트 또는 배지

### 핵심 UX 포인트
- 필터와 검색은 동시에 작동해야 한다.
- Grid/Compact/List 전환은 즉각 반응해야 한다.
- soft-deleted 데이터는 기본 화면에서 보이지 않는다.

---

## 5-3. Work Detail

### 목적
- 작품 자체 정보와 개인 기록을 한 번에 보여준다.

### 레이아웃
상단:
- 좌측: 대형 포스터/썸네일
- 우측: 제목, 타입, 상태, 별점, 티어, 즐겨찾기, 수정 버튼

중단:
- 한줄평
- 상세 리뷰

하단:
- 메타 정보 (작가, 장르, 설명, 타입)
- 감상 관련 정보 (생성일, 수정일, sync 상태)

### 핵심 UX 포인트
- 작품 표지와 제목이 가장 먼저 보이게 한다.
- 개인 감상 정보가 메타데이터보다 우선한다.
- 수정/삭제/동기화 상태를 명확히 보이게 한다.

---

## 5-4. Create / Edit

### 목적
- 기록 입력의 허들을 최소화한다.

### 구조
#### 기본 모드: Quick Add
- 검색
- 후보 선택
- 상태 선택
- 별점
- 한줄평
- 저장

#### 확장 모드: Full Edit
- 타입
- 제목
- 작가/창작자
- 장르
- 설명
- 썸네일 URL
- 상세 리뷰
- 티어
- 즐겨찾기

### UX 원칙
- 기본은 Quick Add가 우선이다.
- Full Edit는 접기/펼치기 또는 별도 구역으로 제공한다.
- 필수 입력은 최소화한다.
- 키보드 사용성이 좋아야 한다.

### 필수 요소
- 자동완성 검색 영역
- 검색 결과 선택 카드
- 저장/취소 버튼
- validation error 표시

---

## 5-5. Activity

### 목적
- 유저의 최근 감상 활동과 수정 내역을 보여준다.

### 구성
- 최근 추가한 작품
- 최근 수정한 작품
- 최근 리뷰 작성 내역
- 상태 변경 히스토리

### UX 포인트
- timeline 형태 권장
- 날짜 기준 정렬
- 상세 페이지와 자연스럽게 연결

---

## 5-6. Insights

### 목적
- 저장된 데이터를 해석 가능한 정보로 바꾼다.

### 필수 구성
- 총 작품 수
- 평균 별점
- 장르 분포
- 타입 분포
- 월별 감상량
- 가장 높은 평가 작품
- 가장 많이 기록한 타입

### 권장 방향
숫자만 보여주지 말고, 해석 문장도 함께 제공한다.
예시:
- 당신은 판타지 비중이 높습니다.
- 평균보다 완결작보다 진행중 작품을 더 자주 기록합니다.
- 리뷰 작성 비율이 높은 편입니다.

---

## 5-7. Profile

### 목적
- 자기 표현
- 공유
- 유입

### 구성
- 닉네임
- 짧은 소개
- 라이브러리 요약
- 대표 통계
- 대표 티어리스트
- 최근 기록
- 공개 작품 목록

### 공개 범위 방향
- 비공개
- 링크 공개
- 전체 공개

### UX 포인트
- 읽기 전용 기준으로 먼저 설계한다.
- 나중에 팔로우/소셜 기능이 붙어도 무너지지 않게 한다.

---

## 5-8. Sync

### 목적
- 로컬 우선 구조를 사용자에게 이해 가능한 형태로 보여준다.

### 필수 구성
- 현재 상태 배지
- 마지막 동기화 시각
- 대기 중 queue 수
- Sync Now 버튼
- 실패 항목 목록
- 충돌 항목 목록

### 상태 예시
- All changes saved locally
- Sync pending
- Syncing now
- Last synced 2m ago
- 2 items failed to sync
- 1 item has conflict

### UX 포인트
- 기술적인 기능이지만 너무 개발자용처럼 보이지 않게 한다.
- 상태는 간단하고 직관적인 문구를 쓴다.

---

## 6. 디자인 시스템

## 6-1. 컬러 시스템

### Foundation Tokens
- `bg.canvas`
- `bg.surface`
- `bg.surfaceElevated`
- `text.primary`
- `text.secondary`
- `text.muted`
- `border.subtle`
- `border.strong`
- `accent.primary`
- `accent.secondary`
- `state.success`
- `state.warning`
- `state.danger`

### 색 방향
- 배경: 딥 네이비 / 차콜
- 포인트: 블루 / 바이올렛 계열
- 텍스트: 차가운 화이트 / 슬레이트 그레이
- 경고/성공색: 저채도 유지

---

## 6-2. 타이포그래피

### 계층
- Display
- Page Title
- Section Title
- Card Title
- Body
- Caption
- Meta

### 원칙
- 제목은 시각적으로 분명하게
- 메타 정보는 한 단계 낮은 강조도
- 긴 텍스트는 가독성 우선
- 한 화면에 타이포 계층은 제한적으로 사용

---

## 6-3. Spacing System

기본 spacing scale:
- 4
- 8
- 12
- 16
- 24
- 32
- 40
- 48

### 원칙
- 카드 내부는 16/24 중심
- 섹션 간 간격은 24/32 중심
- Hero/상단 레이아웃은 32 이상 허용

---

## 6-4. Radius / Shadow / Motion

### Radius
- Button pill
- Card: 16~24
- Input: 12~16

### Shadow
- 과하지 않은 soft shadow
- 깊은 카드만 blur + shadow 조합

### Motion
- 150~250ms
- hover/focus/expand transition 중심
- 과한 animation 금지

---

## 7. 공통 컴포넌트 시스템

### Navigation
- AppShell
- Sidebar
- Topbar
- TabBar
- Breadcrumb

### Data Display
- WorkCard
- WorkRow
- StatCard
- ActivityItem
- EmptyState
- Badge
- SyncStatusBadge

### Inputs
- SearchBar
- FilterSelect
- SegmentedControl
- RatingInput
- TagInput
- StatusSelector
- FavoriteToggle

### Feedback
- Toast
- InlineError
- ErrorBanner
- SuccessBanner
- LoadingSkeleton
- EmptyState

### Overlays
- Modal
- Drawer
- CommandPalette

---

## 8. 반응형 설계 원칙

### Desktop
- 좌측 필터 + 우측 콘텐츠
- 다중 카드 그리드
- 상단 네비게이션 확장형

### Tablet
- 필터는 Drawer 또는 접이식 섹션
- 카드 간격 축소

### Mobile
- 상단 검색 + 핵심 CTA 중심
- Grid는 1~2열
- 상세 페이지는 단일 컬럼
- Quick Add 최우선 노출

### 핵심 원칙
모바일에서는 정보량을 줄이고, 행동 유도와 탐색 속도를 우선한다.

---

## 9. 상용 수준 UX 체크리스트

### 필수
- 검색이 항상 빠르게 접근 가능하다.
- Quick Add가 항상 눈에 띈다.
- Empty state가 행동 유도로 연결된다.
- Loading state가 어색하지 않다.
- 오류 상태가 사용자 친화적으로 보인다.
- 동기화 상태를 사용자가 이해할 수 있다.
- 작품 표지와 개인 기록이 충분히 시각적으로 강조된다.

### 금지
- 긴 입력폼을 처음부터 전부 펼쳐두지 않는다.
- 관리툴처럼 무건조한 UI로 만들지 않는다.
- 화면마다 다른 스타일을 사용하지 않는다.
- 브랜드 감성과 정보 구조가 충돌하지 않게 한다.

---

## 10. 구현 우선순위 (디자인 관점)

### 우선순위 1
- Quick Add UX
- Library 시각적 개선
- Work Detail 재구성

### 우선순위 2
- Home Dashboard
- Insights 시각화
- Profile 공유 페이지

### 우선순위 3
- Activity 화면
- Sync 화면 고도화
- 고급 interaction refinement

---

## 11. 개발 규칙

1. 먼저 디자인 토큰을 만든다.
2. 공통 컴포넌트를 만들고 나서 페이지를 구성한다.
3. 페이지마다 임의 CSS를 늘리기보다 시스템 안에서 변형한다.
4. 작품 썸네일/카드/상세가 비주얼 중심이 되도록 한다.
5. 성능과 접근성을 항상 같이 고려한다.
6. local-first 특성상 저장/동기화 상태 표시는 중요 UI로 취급한다.

---

## 12. 최종 목표

Work Archive의 최종 디자인 목표는 다음과 같다.

- 보기 좋은 기록 앱을 넘어서
- 개인 취향을 관리하고 해석하며 공유할 수 있는
- 상용 수준의 취향 아카이브 플랫폼으로 보이게 만드는 것

즉, 단순히 CRUD 화면이 아니라,
**빠르게 기록하고, 보기 좋게 정리되고, 다시 방문하고 싶고, 공유하고 싶은 서비스 경험**을 만드는 것이 최종 목표다.
