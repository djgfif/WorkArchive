# CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `target UI system` |
| Source of truth | Mantine 기반 target design system rules |
| Last verified against | target UI system document refreshed on `2026-04-21` |
| When to update | Mantine 기준, 토큰 원칙, 공통 컴포넌트 규칙이 바뀔 때 |

이 문서는 Work Archive의 **Mantine 기반 target UI system** 기준이다. 현재 구현 설명이 아니라, 프론트 리팩터링에서 따라야 할 시각/구성 규칙을 정의한다.

## Goal

페이지마다 제각각 클래스를 조합하는 대신, theme와 shared components로 일관된 제품 경험을 만든다.

## Current Baseline

- 현재 구현은 `global.css` 의존이 크다.
- 레이아웃과 페이지 분리는 되어 있지만 시각 시스템은 아직 분산돼 있다.
- 따라서 이 문서는 “지금 이렇게 구현돼 있다”가 아니라 “앞으로 이렇게 맞춘다”는 기준이다.

## Committed Now

### Mantine Is The Primary UI Library

- 공통 UI는 Mantine 우선
- theme로 해결 가능한 문제는 직접 CSS로 다시 만들지 않음
- page shell, card, empty state, action bar 등은 shared primitives로 수렴

### Visual Direction

- 차분한 다크 아카이브 톤
- 콘텐츠 우선 위계
- 절제된 강조색
- 장식보다 구조와 읽기 흐름 우선

### Component Priorities

- app shell
- page header
- section card
- stat card
- form controls
- empty/loading/error states

## Next

- theme tokens 정리
- shared UI primitives 정리
- layout migration
- 핵심 페이지 재구성

## Later / Exploratory

- tier board, community, public profile 전용 visual language
- richer media surfaces
- domain-specific editor patterns

## Dependencies

- Mantine 도입
- frontend blueprint의 route/layout 경계 유지
- final product vision과 충돌하지 않는 visual hierarchy

## Exit Criteria

- theme가 색/spacing/radius/typography의 기준이 된다.
- shared UI 없이 새 화면을 만드는 관성이 줄어든다.
- 현재 구현과 target UI system의 차이가 문서에서 혼동되지 않는다.
