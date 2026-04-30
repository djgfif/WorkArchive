# FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md

| Field                 | Value                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `active`                                                                                                                                                                |
| Role                  | `frontend roadmap`                                                                                                                                                      |
| Source of truth       | [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md), [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md), current `apps/web` implementation |
| Last verified against | `2026-04-25` local `master` working tree                                                                                                                                |
| When to update        | 프론트 상세 실행 순서, Mantine token 기준, 핵심 페이지 우선순위, 완료 기준이 바뀔 때                                                                                    |

이 문서는 Work Archive 프론트의 **단일 상세 실행 로드맵**이다. Mantine foundation은 이미 일부 도입됐고, 이 문서는 남은 migration 순서를 5단계로 고정한다.

## Goal

현재 `global.css` 중심 책임을 줄이고, 이미 연결된 Mantine 기반 shared UI 구조를 Home / Works / Work Detail / Auth / Account의 핵심 화면으로 넓혀 **현업 수준의 B2C/B2B SaaS 제품 밀도**로 끌어올린다.

## Design Workflow Rule

- 프론트엔드 디자인, 화면 구조 탐색, 디자인 시스템 정의, 화면 시안, 스타일 가이드는 **`stich MCP 서버 (Stitch)`를 우선 사용한다.**
- 코드 구현은 `stich MCP 서버` 결과를 기준으로 저장소에서 이어간다.
- 기존 화면의 작은 CSS 수정, 단순 spacing 조정, 비주얼 탐색이 필요 없는 순수 로직 작업은 `stich MCP 서버` 의무 대상이 아니다.

## Current Baseline

- 현재 프론트는 레이아웃 분리와 핵심 라우트 분리가 이미 완료돼 있다.
- `MantineProvider`, `appTheme`, shared page wrapper는 이미 연결돼 있다.
- 스타일 인프라는 여전히 `global.css`에 크게 의존한다.
- shared UI primitives보다 페이지별 클래스 조합이 많다.
- `WorkDetailPanel`, `HomePage`, `WorkCard`, `QuickAddWorkForm` 등 핵심 화면에 커스텀 클래스 결합이 넓게 남아 있다.
- Settings provider readiness 기본 UI와 테스트는 구현돼 있다.
- SyncPage는 pending / failed / conflict queue item 표시, 원인, 기록 보기, 재시도 CTA를 제공한다.
- `Tier Boards`, `Insights`, `Community`는 placeholder 성격이 강하다.

## Committed Now

### Phase 1. 시각적 노이즈 제거 및 기초 공사

목표:

- `global.css`에서 장식적 레이어를 걷어내고, 전역 CSS의 역할을 최소 전역 규칙과 예외적 미디어 보정 수준으로 축소한다.

실행 기준:

- `radial-gradient`, glow, backdrop 성격의 배경 장식은 기본값에서 제거한다.
- `.app-shell-glow`와 유사한 네온/오브젝트형 장식은 더 이상 확장하지 않는다.
- `layout-backdrop`, 과한 gradient background, glass-like 효과는 유지 기본값이 아니라 제거 대상로 본다.
- 전역 버튼/입력/배경 스타일은 가능한 한 theme 혹은 Mantine component default로 이동한다.
- `global.css`는 reset, 기본 typography 보정, focus, media 보정, 최소 layout fallback 중심으로 재정의한다.

완료 기준:

- 프론트 시각 인상이 장식보다 콘텐츠 중심으로 바뀐다.
- 새 화면을 만들 때 `global.css`의 신규 장식 클래스를 기본값으로 추가하지 않는다.

### Phase 2. 디자인 토큰 시스템 확립

목표:

- `apps/web/src/app/mantine-theme.ts`를 색, radius, spacing, typography, shadow, component defaults의 단일 기준점으로 고정한다.

실행 기준:

- `colors`는 archive 브랜드 팔레트와 dark surface용 중립 팔레트를 함께 설명하는 기준이 된다.
- `radius`만이 아니라 `spacing`, `fontSizes`, `lineHeights`, `fontWeights`, `headings`, `shadows`, `components`까지 theme 범위를 넓힌다.
- `var(--accent)`, `var(--text-primary)`, `var(--border-soft)` 같은 직접 참조는 단계적으로 Mantine theme value 또는 component styles/classNames로 치환한다.
- 컴포넌트 수준 스타일은 `styles` prop 남발보다 theme `components`, `classNames`, shared wrappers 중심으로 이동한다.
- theme에서 해결 가능한 문제를 페이지 CSS로 다시 정의하지 않는다.

근거:

- Mantine theme object는 `colors`, `radius`, `spacing`, `shadows`, `components`를 중앙 기준으로 제공한다. [Theme object](https://mantine.dev/theming/theme-object/)
- Mantine styling은 `theme.components`, `classNames`, `styles`, CSS variables resolver 기반으로 확장한다. [Styles API](https://mantine.dev/styles/styles-api/)

완료 기준:

- 시각 토큰의 source of truth를 설명할 때 `global.css`가 아니라 `mantine-theme.ts`를 먼저 가리키게 된다.
- shared component가 전역 CSS 변수 직접 참조 없이도 공통 색/spacing/radius를 설명할 수 있다.

### Phase 3. 공통 UI 레이어 구축

목표:

- `.panel`, `.work-card`, `.badge`, `.primary-link`, `.secondary-link` 같은 커스텀 조합을 Mantine primitives와 shared wrapper로 수렴시킨다.

실행 기준:

- `Card`, `Paper`, `Group`, `Stack`, `Flex`, `Badge`, `Button`, `Text`, `Title`, `SimpleGrid` 같은 Mantine primitives를 기본 조합으로 삼는다.
- `SectionCard`, `PageShell`, `PageHero`, `StateMessage`, `ActionRow` 등 shared wrapper는 Mantine 위에 얇게 쌓는 방향으로 유지한다.
- 새 shared primitive는 시각 장식보다 정보 구조와 상태 표현을 우선한다.
- 공통 CTA, empty/loading/error state, filter/action bar, stat card를 shared 계층으로 수렴시킨다.
- placeholder 화면도 같은 primitives 위에서 렌더링되도록 유지한다.

완료 기준:

- 페이지별 HTML + class 조합보다 shared component 조합 비중이 높아진다.
- 새 화면을 만들 때 `.panel`류 글로벌 클래스부터 찾는 관성이 줄어든다.

### Phase 4. 핵심 페이지의 계층 구조 재설계

우선순위:

1. Home
2. Works
3. Work Detail
4. Auth
5. Account / Sync / Settings

목표:

- 각 페이지를 Content-First 원칙으로 재구성하고, 시각 위계보다 읽기 흐름을 먼저 고정한다.

실행 기준:

- Home은 소개보다 검색, 빠른 추가, 최근 기록, 핵심 통계가 먼저 보이게 유지한다.
- Works는 탐색과 관리가 주역인 workspace 성격을 강화한다.
- Work Detail은 작품 메타데이터보다 **내 감상 기록**이 먼저 읽히도록 구조를 재배치한다.
- Work Detail 상단은 상태, 별점, 한줄평, 리뷰, 빠른 수정 행동이 주인공이어야 한다.
- Auth는 입력 집중형, Account는 관리형 맥락으로 시각 밀도를 구분한다.
- placeholder 목적지도 CTA와 상태 설명은 같은 제품 톤을 유지한다.

완료 기준:

- Work Detail을 읽을 때 작품 정보보다 한줄평과 감상 기록이 먼저 눈에 들어온다.
- Home / Works / Work Detail / Auth / Account의 archetype 차이가 구조적으로 분명해진다.

### Phase 5. 현업 수준의 다크 모드 디테일 구현

목표:

- 차분하고 고급스러운 다크 모드 원칙을 적용하되, 장식적 다크 테마가 아니라 읽기 좋은 제품 다크 모드로 정리한다.

실행 기준:

- 순수 블랙 `#000000`은 기본 surface로 쓰지 않는다.
- 주요 dark surface는 `#121212`, `#1C1C1E` 혹은 그에 준하는 dark gray/navy 계열을 기준으로 잡는다.
- 그림자보다 border, surface 명도 차, subtle separator를 통해 elevation을 만든다.
- accent color는 1~2개만 절제해서 사용한다.
- 본문 대비는 WCAG AA 수준을 기본값으로 본다.
- light-on-dark typography는 광택감이 아니라 안정감을 우선해 weight, line-height, spacing을 보정한다.
- 포스터나 밝은 이미지 주변은 섬세한 border나 containment로 다듬는다.

근거:

- 다크 모드는 순수 블랙보다 `#121212`, `#1C1C1E` 같은 surface가 읽기 피로를 줄이고, 대비 기준은 4.5:1 이상을 권장한다. [Lovable dark mode guide](https://lovable.dev/guides/dark-mode-website-examples-guide)
- pure black/white 고대비는 장시간 읽기에 불리하며, dark mode는 subtle border와 contained image treatment가 중요하다. [iCreationsLAB dark mode guide](https://icreationslab.com/dark-mode-web-design-a-complete-guide/)

완료 기준:

- 다크 모드가 네온/글래스 톤이 아니라 차분한 SaaS 제품 톤으로 읽힌다.
- depth 표현이 box-shadow 의존이 아니라 surface hierarchy와 border 설계로 설명된다.

## Next

- Work Create / Edit 입력 경험 polish
- Sync conflict 해결 UX polish와 자동 병합 정책 검토
- provider별 ranking/search quality와 Settings provider readiness polish
- placeholder 목적지의 CTA 품질 향상
- Mantine 기반 공통 feedback 패턴 정리

## Dependencies

- 현재 route와 layout 경계 유지
- shared UI naming 정리
- product roadmap과 IA 충돌 방지
- placeholder 페이지가 본 기능 구현 전까지도 같은 UI 기준을 따르도록 유지

## Exit Criteria

- `FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`가 프론트 상세 실행 단계의 단일 기준으로 읽힌다.
- `mantine-theme.ts`가 시각 토큰의 source of truth가 된다.
- Home / Works / Work Detail / Auth / Account가 shared primitives 중심 구조로 재구성된다.
- `global.css`는 최소 전역 스타일과 예외적 미디어 보정 수준으로 축소된다.
- product 문서는 이 문서의 단계 설명을 반복하지 않고, 사용자 가치와 우선순위만 설명한다.
