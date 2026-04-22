# CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `target UI system` |
| Source of truth | Mantine 기반 target design system rules, [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md) |
| Last verified against | `2026-04-22` working tree |
| When to update | Mantine 기준, 토큰 원칙, 다크 모드 시각 원칙, 공통 컴포넌트 규칙이 바뀔 때 |

이 문서는 Work Archive의 **Mantine 기반 target UI system** 기준이다. 현재 구현 설명이나 단계별 체크리스트가 아니라, 리팩터링에서 따라야 할 시각/구성 원칙을 정의한다.

## Goal

페이지마다 제각각 클래스를 조합하는 대신, theme와 shared components로 일관된 제품 경험을 만든다.

## System Principles

### Mantine Is The Primary UI Library

- 공통 UI는 Mantine 우선
- theme로 해결 가능한 문제는 직접 CSS로 다시 만들지 않음
- page shell, card, empty state, action bar, feedback state는 shared primitives로 수렴
- Mantine 확장은 `theme.components`, `classNames`, shared wrapper를 우선 사용

### Theme First

- 색, spacing, radius, typography, component defaults는 theme가 기준이 된다
- 시각 토큰은 scattered CSS variable보다 중앙 통제형 theme로 모인다
- shared component는 가능한 한 토큰 소비자여야 하고, 자체 토큰 소유자가 되어서는 안 된다

근거:

- Mantine theme는 `colors`, `radius`, `spacing`, `shadows`, `components`를 중앙 정의로 제공한다. [Theme object](https://mantine.dev/theming/theme-object/)
- Mantine styling은 component-level styles, classNames, CSS variables resolver로 확장한다. [Styles API](https://mantine.dev/styles/styles-api/)

### Content First

- 작품 정보보다 사용자 기록과 읽기 흐름이 먼저 보여야 한다
- Home은 행동 시작점, Works는 관리 공간, Work Detail은 감상 기록 중심, Auth는 입력 집중, Account는 관리 중심으로 읽혀야 한다
- 장식은 구조를 보조할 뿐, 정보 위계를 앞지르지 않는다

### Calm Premium

- 기본 인상은 조용하고 정돈된 premium SaaS 톤이어야 한다
- 과한 네온, 과한 글래스, 과한 gradient, 과한 glow는 피한다
- 고급스러움은 장식이 아니라 spacing, typography, contrast, restraint에서 온다

### Dark-Mode Tone

- 순수 블랙보다 dark gray / deep navy surface를 사용한다
- elevation은 무거운 shadow보다 border, separator, surface contrast로 만든다
- body text는 밝지만 눈부시지 않은 회색 계열을 기본으로 한다
- 포스터와 밝은 이미지는 주변 containment를 통해 다크 surface와 자연스럽게 맞춘다

참고:

- `#121212`, `#1C1C1E` 계열 surface와 적정 contrast는 읽기 피로를 줄이는 기본 패턴이다. [Lovable dark mode guide](https://lovable.dev/guides/dark-mode-website-examples-guide/)
- pure black / pure white 고대비는 장시간 읽기에 불리하고, subtle border와 image containment가 중요하다. [iCreationsLAB dark mode guide](https://icreationslab.com/dark-mode-web-design-a-complete-guide/)

### Accent Restraint

- 강조색은 1~2개만 사용한다
- accent는 CTA, active state, 중요한 metadata 강조에만 쓴다
- 카드 전체를 accent로 칠해 존재감을 만드는 방식은 기본값이 아니다

### Accessibility And Motion

- 대비는 WCAG AA 수준을 기본 품질로 본다
- 포커스 링은 장식이 아니라 기능이다
- 모션은 의미 있는 전환에만 제한적으로 사용한다
- 읽기 순서와 키보드 탐색을 방해하는 레이아웃은 허용하지 않는다

## Exit Criteria

- theme가 색/spacing/radius/typography의 기준이 된다.
- shared UI 없이 새 화면을 만드는 관성이 줄어든다.
- 현재 구현과 target UI system의 차이가 문서에서 혼동되지 않는다.
- 단계별 실행 방법은 [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)에서만 다룬다.
