# Work Archive 프론트엔드 개발 가이드 (v3.0.0)

> **최종 업데이트**: 2026-05-19 | **대상 브랜치**: `master` | **커밋**: `4dcf729`

본 문서는 대기업 상용 서비스(Linear, Vercel, Apple TV+) 수준으로 전면 업그레이드된 Work Archive 웹 애플리케이션의 프론트엔드 아키텍처, 디자인 시스템, 인터랙션 패턴, 컴포넌트 사용 가이드를 정의합니다. 신규 기능 개발, 버그 수정, 코드 리뷰 시 본 문서를 기준으로 삼으십시오.

---

## 목차

1. [디자인 시스템 아키텍처](#1-디자인-시스템-아키텍처)
2. [레이아웃 및 내비게이션](#2-레이아웃-및-내비게이션)
3. [핵심 컴포넌트 사용 가이드](#3-핵심-컴포넌트-사용-가이드)
4. [인터랙션 및 애니메이션 패턴](#4-인터랙션-및-애니메이션-패턴)
5. [키보드 단축키 및 접근성](#5-키보드-단축키-및-접근성)
6. [CSS 모듈 작성 규칙](#6-css-모듈-작성-규칙)
7. [리팩토링 체크리스트](#7-리팩토링-체크리스트)
8. [버전 변경 이력](#8-버전-변경-이력)

---

## 1. 디자인 시스템 아키텍처

Work Archive는 **Mantine 7 + 커스텀 CSS 변수**를 결합한 하이브리드 아키텍처를 사용합니다. 컴포넌트의 논리적 구조(접근성, 반응형, 상태 관리)는 Mantine이 담당하고, 시각적 표현(색상, 모션, 여백, 그림자)은 `global.css`의 `--app-*` / `--wa-*` 커스텀 변수가 완전히 제어합니다.

### 1.1. 색상 시스템 ("Calm Premium Dark")

순수 블랙(`#000000`)을 배제하고 **깊은 네이비 블루 톤**을 베이스로 사용하여 눈의 피로를 줄이고 콘텐츠 몰입도를 높였습니다. 모든 색상은 라이트/다크 모드에서 독립적으로 정의됩니다.

| 토큰 | 다크 모드 | 라이트 모드 | 용도 |
|---|---|---|---|
| `--app-bg-shell` | `#0A0E17` | `#F8FAFC` | 최하단 배경 |
| `--app-bg-elevated` | `#141928` | `#FFFFFF` | 팝오버, 드롭다운 |
| `--app-surface-subtle` | `rgba(255,255,255,0.02)` | `rgba(0,0,0,0.02)` | 보조 카드, 툴바 |
| `--app-surface-card` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` | 메인 카드, 리스트 행 |
| `--app-surface-hero` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` | 히어로 섹션 |
| `--app-border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.07)` | 구분선, 카드 테두리 |
| `--app-border-default` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.12)` | 입력 폼, 포커스 상태 |
| `--app-border-strong` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.18)` | 강조 테두리 |
| `--app-text-primary` | `#F1F5F9` | `#0F172A` | 본문 텍스트 |
| `--app-text-secondary` | `#94A3B8` | `#475569` | 보조 텍스트 |
| `--app-text-muted` | `#64748B` | `#94A3B8` | 비활성 텍스트 |
| `--app-accent-primary` | `archive.5` (`#3B82F6`) | `archive.6` (`#2563EB`) | 브랜드 강조색 |

> **규칙**: 컴포넌트 내부에서 절대로 `#RRGGBB` 형식의 하드코딩된 색상을 사용하지 않습니다. 반드시 위 테마 변수를 사용하십시오.

### 1.2. 모션 시스템 (Spring Animation)

모든 인터랙션에는 **Spring 타이밍 함수** `cubic-bezier(0.16, 1, 0.3, 1)`이 적용됩니다. 이 곡선은 빠르게 시작하여 목표값에 부드럽게 안착하는 "탄성 있는" 느낌을 주며, Linear와 Vercel에서 사용하는 것과 동일한 방식입니다.

| 변수 | 값 | 용도 |
|---|---|---|
| `--wa-motion-instant` | `80ms spring` | 즉각적인 피드백 (체크박스 등) |
| `--wa-motion-fast` | `150ms spring` | 버튼 호버, 색상 전환 |
| `--wa-motion-normal` | `240ms spring` | 카드 호버, 그림자 전환 |
| `--wa-motion-slow` | `380ms spring` | 아코디언, Collapse 패널 |
| `--wa-motion-enter` | `300ms spring` | 모달 진입, 페이지 전환 |
| `--wa-motion-exit` | `180ms ease-in` | 모달 퇴장 |

```css
/* ✅ 올바른 사용 예 */
.myCard {
  transition:
    transform var(--wa-motion-normal),
    box-shadow var(--wa-motion-normal),
    border-color var(--wa-motion-fast);
}

/* ❌ 잘못된 사용 예 — 하드코딩 금지 */
.myCard {
  transition: transform 200ms ease;
}
```

### 1.3. 타이포그래피

본문 폰트는 **Pretendard Variable**을 사용하며, 다음 CSS 속성이 전역(`body`)에 적용되어 있습니다.

```css
body {
  font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 숫자 정렬 및 합자 활성화 — v3.0.0 신규 */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "kern" 1, "liga" 1;
}
```

타이포그래피 스케일은 `--wa-type-*` 변수로 정의되며, 반응형 `clamp()` 함수를 사용합니다.

| 변수 | 값 | 용도 |
|---|---|---|
| `--wa-type-display` | `clamp(2.4rem, 7vw, 5.2rem)` | 랜딩 히어로 제목 |
| `--wa-type-h1` | `clamp(1.9rem, 4.5vw, 3.6rem)` | 페이지 주 제목 |
| `--wa-type-h2` | `clamp(1.35rem, 2.8vw, 2rem)` | 섹션 제목 |
| `--wa-type-h3` | `1.08rem` | 카드 제목 |
| `--wa-type-body` | `1rem` | 본문 |
| `--wa-type-caption` | `0.84rem` | 캡션, 메타 정보 |
| `--wa-type-meta` | `0.76rem` | 배지, 라벨 |

**자간(Letter Spacing) 규칙:**

- Eyebrow(소제목 레이블): `letter-spacing: 0.08em ~ 0.10em`
- 제목(H1~H3): `letter-spacing: -0.025em ~ -0.03em`
- 내비게이션 링크: `letter-spacing: -0.01em`
- 본문: 기본값 사용

### 1.4. 그림자 시스템

```css
--wa-shadow-card:    0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2);
--wa-shadow-overlay: 0 4px 16px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.3);
--wa-shadow-poster:  0 12px 32px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3);
```

---

## 2. 레이아웃 및 내비게이션

### 2.1. 헤더 (3단 Grid 구조)

헤더는 `display: grid`를 사용하여 **좌(브랜드) / 중(내비게이션) / 우(프로필)**의 3단 구조를 완벽하게 분리합니다. 이 구조를 통해 내비게이션이 항상 화면 정중앙에 위치합니다.

```tsx
// MainProductLayout.tsx — 헤더 3단 Grid 구조
<Box
  style={{
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    height: '100%',
  }}
>
  <Box style={{ justifySelf: 'start' }}>
    <BrandLink heading="Work Archive" kicker="아카이브" />
  </Box>
  <Box style={{ justifySelf: 'center' }}>
    {/* 데스크탑 내비게이션 */}
  </Box>
  <Box style={{ justifySelf: 'end' }}>
    {/* 프로필 아바타 버튼 */}
  </Box>
</Box>
```

헤더는 `position: sticky; top: 0`으로 고정되며, `backdrop-filter: blur(12px)`와 반투명 배경으로 글래스모피즘 효과를 구현합니다.

### 2.2. 페이지 전환 애니메이션

`Outlet`을 감싸는 `PageTransitionWrapper` 컴포넌트를 통해, 라우트 변경 시마다 `pageEnter` 키프레임이 실행됩니다.

```tsx
// MainProductLayout.tsx
function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{ animation: 'pageEnter 280ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
      {children}
    </Box>
  );
}
```

```css
/* global.css */
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 3. 핵심 컴포넌트 사용 가이드

### 3.1. AppBadge — 상태 및 메타 태그

`AppBadge`는 상태, 유형, 결과 등을 표시하는 범용 배지 컴포넌트입니다. v3.0.0에서 `tone` 속성이 확장되었습니다.

| `tone` 값 | 색상 | 사용 시나리오 |
|---|---|---|
| `"accent"` | 브랜드 블루 | 완료, 즐겨찾기, 강조 |
| `"info"` | 파란색 | 진행 중 (`in_progress`) |
| `"success"` | 청록색(teal) | 긍정적 결과, 신뢰도 높음 |
| `"warning"` | 노란색 | 주의, 비슷한 기록 존재 |
| `"error"` / `"danger"` | 빨간색 | 에러, 삭제, 중단 |
| `"muted"` | 회색 outline | 보조 정보 (유형, 티어, 소스) |
| `"default"` | 회색 | 일반 태그 |

```tsx
// ✅ 올바른 사용 예 — 상태에 따른 tone 선택
<AppBadge tone={
  work.status === 'completed'  ? 'accent'  :
  work.status === 'in_progress' ? 'info'   :
  work.status === 'dropped'     ? 'danger' :
  'muted'
}>
  {statusLabel}
</AppBadge>
```

### 3.2. AppButton — 액션 버튼

`AppButton`은 Mantine `Button`의 래퍼로, `tone` prop으로 시각적 변형을 제어합니다. v3.0.0에서 `style` prop이 추가되었습니다.

| `tone` 값 | 스타일 | 용도 |
|---|---|---|
| `"primary"` | 그라디언트 채우기 | 주요 CTA (저장, 추가) |
| `"secondary"` | 기본 테두리 | 보조 액션 |
| `"quiet"` | 회색 subtle | 덜 중요한 액션 |
| `"ghost"` | 투명 | 아이콘 버튼, 내비게이션 |
| `"danger"` | 빨간색 light | 삭제, 위험 액션 |

```tsx
// ✅ 정렬 방향 토글 버튼 — style prop 활용 예
<AppButton
  aria-label="정렬 방향 전환"
  aria-pressed={sortAsc}
  onClick={() => setSortAsc((v) => !v)}
  size="compact-sm"
  tone="secondary"
  style={{ fontVariantNumeric: 'tabular-nums', minWidth: 40 }}
>
  {sortAsc ? '↑ ASC' : '↓ DESC'}
</AppButton>
```

### 3.3. WorkPosterCard — 포스터 카드

작품 목록 그리드 뷰의 핵심 카드 컴포넌트입니다.

**호버 이펙트 (3단 레이어 그림자)**:

```css
/* ArchiveComponents.module.css */
.posterCardSurface:hover {
  transform: translateY(-6px);
  box-shadow:
    0 0 0 1px var(--app-border-default),        /* 1. 테두리 강조 */
    0 8px 24px rgba(0, 0, 0, 0.4),              /* 2. 중간 그림자 */
    0 20px 48px rgba(0, 0, 0, 0.3);             /* 3. 원거리 그림자 */
}
.posterCardSurface:hover .posterCard {
  transform: scale(1.05);                        /* 이미지 미세 확대 */
}
```

**상태 오버레이 배지 (v3.0.0 신규)**:

포스터 카드 하단에 반투명 그라디언트 오버레이와 함께 현재 상태가 배지로 표시됩니다.

```tsx
// ArchiveComponents.tsx — WorkPosterCard 내부
<Box className={cn(css.statusOverlay)}>
  <AppBadge tone={statusTone}>{statusLabel}</AppBadge>
</Box>
```

```css
/* ArchiveComponents.module.css */
.statusOverlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem 0.6rem 0.6rem;
  background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%);
  display: flex;
  justify-content: flex-start;
}
```

### 3.4. FilterPillGroup — 세그먼트 컨트롤 필터

상태 필터 UI는 개별 버튼 나열에서 **Apple/Linear 스타일 세그먼트 컨트롤**로 업그레이드되었습니다.

```css
/* ArchiveComponents.module.css */
.filterPillTray {
  display: flex;
  gap: 2px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--mantine-radius-lg);
  padding: 3px;
}

.filterPill[data-active='true'] {
  background: var(--app-surface-card);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  color: var(--app-text-primary);
}
```

### 3.5. ArchiveEmptyState — 빈 상태 일러스트

데이터가 없는 화면은 SVG 인라인 일러스트와 CSS 애니메이션으로 감성적인 경험을 제공합니다.

```css
/* 부유 애니메이션 */
.emptyFloat1 { animation: emptyFloat 3.6s ease-in-out infinite; }
.emptyFloat2 { animation: emptyFloat 4.2s ease-in-out 0.4s infinite; }
.emptyFloat3 { animation: emptyFloat 3.9s ease-in-out 0.8s infinite; }
.emptySparkle1 { animation: emptySparkle 2.4s ease-in-out infinite; }

@keyframes emptyFloat {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-5px); }
}

/* 접근성 — 모션 감소 설정 시 비활성화 */
@media (prefers-reduced-motion: reduce) {
  .emptyFloat1, .emptyFloat2, .emptyFloat3,
  .emptySparkle1, .emptySparkle2 { animation: none; }
}
```

### 3.6. WorkDetailPanel — 상세 히어로 레이아웃

작품 상세 페이지 상단은 **Apple TV+ 스타일의 계층적 레이아웃**을 사용합니다.

```
┌─────────────────────────────────────────────────────┐
│  [포스터]    [유형 배지] · [상태 배지] · [즐겨찾기]  │
│             [작품 제목 — 대형 타이포]                │
│             [저자 · 최근 수정일]                     │
│             [별점: 4.5 / 5.0]  [진행도: 12 / 24화]  │
│             [진행도 바]                              │
│             [수정 버튼] [리뷰 쓰기 버튼]             │
└─────────────────────────────────────────────────────┘
```

---

## 4. 인터랙션 및 애니메이션 패턴

### 4.1. 호버 패턴 — 카드 Lift 효과

모든 클릭 가능한 카드와 행(Row)은 호버 시 `translateY(-Npx)` lift 효과를 사용합니다.

| 컴포넌트 | Lift 값 | 그림자 |
|---|---|---|
| `WorkPosterCard` | `-6px` | 3단 레이어 |
| `SurfaceLinkCard` | `-3px` | `--wa-shadow-card` |
| `CandidateListRow` | `-1px` | 없음 |
| `WorkListRow` | `-1px` | 없음 |

### 4.2. 포커스 링 패턴

모든 인터랙티브 요소의 포커스 링은 일관된 스타일을 사용합니다.

```css
/* global.css */
:focus-visible {
  outline: 2px solid var(--app-accent-primary);
  outline-offset: 2px;
  border-radius: var(--mantine-radius-sm);
}
```

검색 인풋의 포커스 링은 이중 레이어를 사용하여 더 강조됩니다.

```css
/* ArchiveComponents.module.css */
.searchInput:focus-within {
  border-color: var(--app-accent-primary) !important;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.20),
    0 1px 4px rgba(0, 0, 0, 0.25);
}
```

### 4.3. 홈 페이지 활동 타임라인 (v3.0.0 신규)

홈 페이지에 최근 수정된 작품을 날짜별로 그룹화한 타임라인 섹션이 추가되었습니다.

```tsx
// HomePage.tsx — 날짜 그룹화 로직
function groupByDate(works: WorkRecord[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  return works.reduce((acc, work) => {
    const d = new Date(work.updatedAt).toDateString();
    const label =
      d === today     ? '오늘' :
      d === yesterday ? '어제' :
      `${Math.floor((Date.now() - new Date(work.updatedAt).getTime()) / 86400000)}일 전`;
    (acc[label] ??= []).push(work);
    return acc;
  }, {} as Record<string, WorkRecord[]>);
}
```

---

## 5. 키보드 단축키 및 접근성

### 5.1. 전역 단축키 (`WorksToolbar.tsx`)

`@mantine/hooks`의 `useHotkeys`를 사용하여 구현되었습니다.

| 단축키 | 동작 | 조건 |
|---|---|---|
| `/` | 검색창 포커스 및 전체 선택 | 항상 |
| `Escape` | 검색어 초기화 및 포커스 해제 | 검색어 입력 시 |
| `g` | 그리드 ↔ 리스트 뷰 토글 | 입력 필드 외부 |
| `f` | 고급 필터 패널 열기/닫기 | 항상 |

```tsx
// WorksToolbar.tsx
useHotkeys([
  ['slash', () => { searchRef.current?.focus(); searchRef.current?.select(); }],
  ['Escape', () => {
    if (query.searchTerm) {
      onQueryChange({ ...query, searchTerm: '' });
      searchRef.current?.blur();
    }
  }],
  ['g', () => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')],
  ['f', () => setAdvancedOpen((v) => !v)],
]);
```

### 5.2. 접근성 필수 사항

모든 인터랙티브 컴포넌트는 다음 접근성 요건을 충족해야 합니다.

- 버튼에는 반드시 `aria-label` 또는 텍스트 콘텐츠를 제공합니다.
- 토글 버튼에는 `aria-pressed` 속성을 사용합니다.
- 확장/축소 패널에는 `aria-expanded` 속성을 사용합니다.
- `prefers-reduced-motion: reduce` 미디어 쿼리를 반드시 지원합니다.

```css
/* global.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    will-change: auto !important;
  }
}
```

---

## 6. CSS 모듈 작성 규칙

### 6.1. 클래스 네이밍 컨벤션

CSS 모듈 클래스명은 **camelCase**를 사용하며, 컴포넌트 이름을 접두사로 붙입니다.

```css
/* ✅ 올바른 예 */
.posterCardSurface { ... }
.detailHeroPoster { ... }
.filterPillTray { ... }

/* ❌ 잘못된 예 */
.poster-card-surface { ... }
.PosterCardSurface { ... }
```

### 6.2. CSS 변수 사용 원칙

CSS 모듈 내에서 색상, 여백, 모션 값을 직접 작성하지 않고 반드시 `--app-*` / `--wa-*` 변수를 참조합니다.

```css
/* ✅ 올바른 예 */
.myComponent {
  background: var(--app-surface-card);
  border: 1px solid var(--app-border-subtle);
  transition: transform var(--wa-motion-normal);
}

/* ❌ 잘못된 예 */
.myComponent {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: transform 240ms ease;
}
```

---

## 7. 리팩토링 체크리스트

기존 v1/v2 코드를 v3.0.0 아키텍처로 마이그레이션할 때 다음 항목을 순서대로 확인하십시오.

1. **하드코딩된 색상 제거**: `style={{ color: '#888' }}`와 같은 인라인 색상을 `var(--app-text-secondary)` 등 테마 변수로 교체합니다. (`CandidateListRow.tsx` 참고)
2. **모션 변수 적용**: 모든 `transition` 속성을 `var(--wa-motion-*)` 변수로 교체합니다.
3. **AppBadge tone 확인**: `tone="primary"`는 유효하지 않습니다. `"accent"` 또는 `"info"`로 교체합니다.
4. **컴포넌트 밀도 조절**: 리스트 행/카드에서 한줄평, 설명 텍스트를 제거하고 `AppBadge`로 요약합니다.
5. **숫자 표시**: 별점, 진행도, 날짜 등 숫자가 포함된 텍스트에 `style={{ fontVariantNumeric: 'tabular-nums' }}`를 추가합니다.
6. **접근성 속성 추가**: 토글 버튼에 `aria-pressed`, 확장 패널 버튼에 `aria-expanded`를 추가합니다.

---

## 8. 버전 변경 이력

| 버전 | 커밋 | 주요 변경 사항 |
|---|---|---|
| **v3.0.0** | `4dcf729` | 포스터 카드 상태 오버레이, 상세 히어로 재설계, 빈 상태 SVG 일러스트, 페이지 전환 애니메이션, 키보드 단축키, 홈 타임라인, CandidateListRow 테마 통일, AppBadge tone 확장 |
| **v2.1.0** | `bf0e2ab` | 헤더 3단 Grid 구조, 프로필 메뉴 우측 고정, 카드 한줄평 전면 제거 |
| **v2.0.0** | `e88a90e` | Archive Blue 팔레트, Spring 모션 시스템, FilterPillGroup 세그먼트 컨트롤, QuickStat 글래스모피즘 |
| **v1.0.0** | 초기 | Mantine 기본 테마, 기본 레이아웃 |
