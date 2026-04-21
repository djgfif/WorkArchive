# FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `frontend roadmap` |
| Source of truth | [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md), [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md) |
| Last verified against | `2026-04-21` working tree |
| When to update | Mantine 도입 범위, 실행 순서, 완료 기준이 바뀔 때 |

이 문서는 Work Archive 프론트의 **Mantine 전환 실행 계획**이다. Mantine는 현재 구현이 아니라, 이번 프론트 리팩터링에서 커밋된 목표다.

## Goal

현재 `global.css` 중심 UI를 Mantine 기반 shared UI 구조로 옮기고, Home / Works / Work Detail / Auth / Account의 핵심 화면을 더 명확한 서비스형 화면으로 재구성한다.

## Current Baseline

- 현재 프론트는 레이아웃 분리와 핵심 라우트 분리가 이미 완료돼 있다.
- 스타일 인프라는 아직 Mantine가 아니라 `global.css`에 크게 의존한다.
- shared UI primitives보다 페이지별 클래스 조합이 많다.
- 제품 확장 목적지와 실제 구현 화면의 시각 성숙도 차이가 크다.

## Committed Now

### Phase 1. Style Infrastructure

- Mantine 설치
- `MantineProvider` 연결
- theme 파일 도입
- 최소 전역 스타일만 남기는 방향으로 CSS 역할 축소

### Phase 2. Shared UI Primitives

- page shell
- page header
- section card
- stat card
- empty state
- action bar
- filter bar
- poster/media wrapper

### Phase 3. Layout Migration

- `MainProductLayout`
- `AuthLayout`
- `AccountLayout`

현재 route tree는 유지하되, 레이아웃 내부 구조를 Mantine 기준으로 정리한다.

### Phase 4. Core Page Migration

우선순위:

1. Home
2. Works
3. Work Detail
4. Auth
5. Account / Sync / Settings

### Phase 5. Cleanup

- `global.css` 중 theme나 component로 이동 가능한 규칙 제거
- placeholder 화면 공통화
- loading / error / empty state 통일

## Next

- Work Create / Edit 입력 경험 polish
- Sync 상태 표현 개선
- placeholder 목적지의 CTA 품질 향상
- Mantine 기반 공통 feedback 패턴 정리

## Later / Exploratory

- Tier Boards 전용 편집기 시각 설계
- Community / Insights의 도메인 특화 화면
- 공개 프로필과 public surface용 별도 visual language

## Dependencies

- 현재 route와 layout 경계 유지
- shared UI naming 정리
- product roadmap과 IA 충돌 방지
- placeholder 페이지가 본 기능 구현 전까지도 같은 UI 기준을 따르도록 유지

## Exit Criteria

- 앱이 Mantine provider 아래에서 렌더링된다.
- theme가 주요 시각 토큰의 기준이 된다.
- Home / Works / Work Detail / Auth / Account가 Mantine 기반 shared primitives로 재구성된다.
- `global.css`는 최소 전역 스타일과 예외적 미디어 보정 수준으로 축소된다.
- Mantine 관련 문서가 현재 구현 설명과 혼동되지 않는다.
