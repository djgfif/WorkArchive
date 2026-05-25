# FRONTEND_FOUNDATION_MASTERPLAN.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `target frontend structure` |
| Source of truth | [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md), current route/layout tree |
| Last verified against | `2026-04-21` working tree |
| When to update | 프론트 구조 과제, shared UI 경계, 페이지 archetype 기준이 바뀔 때 |

이 문서는 프론트의 **남은 구조 과제**를 정리하는 canonical 문서다. 현재 구현 설명은 `FRONTEND_BLUEPRINT_V1.md`, Mantine 도입 실행 순서는 `FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`에서 다룬다.

## Goal

현재 분리된 레이아웃과 페이지 흐름을 유지하면서, 프론트를 **유지보수 가능한 서비스형 구조**로 고정한다.

## Current Baseline

- 레이아웃 분리는 이미 완료됐다.
- Home / Works / Work Detail / Auth / Account는 서로 다른 페이지 성격을 갖는다.
- local-first 저장 구조와 계정별 로컬 아카이브 분리는 실제 구현돼 있다.
- 남은 문제는 주로 스타일 책임, shared UI 부재, placeholder 관리, 페이지 archetype 정리다.

## Committed Now

### 1. Route Ownership Is Stable

이번 구조 단계에서는 현재 라우트 의미를 크게 흔들지 않는다.

- Home은 메인 허브
- Works는 관리 워크스페이스
- Work Create는 플로우 페이지
- Work Detail은 감상 기록 디테일
- Account는 관리 영역

### 2. Shared UI Layer Becomes Mandatory

화면별 중복 구조를 줄이기 위해 shared UI 계층을 명시적으로 둔다.

우선순위:

- page shell
- page header
- section card
- empty state
- stat card
- action/filter bar

### 3. Page Archetypes Are Explicit

이후 프론트 변경은 아래 archetype을 기준으로 판단한다.

- hub
- workspace
- flow
- detail
- auth
- account
- minimal

### 4. Placeholder Strategy Is Controlled

`Tier Boards`, `Insights`, `Community`처럼 기능 성숙도가 낮은 목적지는, 임시 화면이라도 메인 제품 구조를 깨지 않게 같은 shared shell 위에서 정리한다.

## Next

- shared page template와 공통 상태 컴포넌트 도입
- `global.css` 의존 축소
- Home / Works / Work Detail / Auth / Account의 시각적 책임 분리 강화
- create/edit/sync/settings 화면의 입력 흐름 정리
- placeholder 목적지의 메시지/CTA/레이아웃 일관화

## Later / Exploratory

- 공개 프로필과 개인 프로필의 분리
- public/community 전용 레이아웃 확장
- tier board 전용 편집 경험
- quick add의 외부 metadata 후보 비교 UX

## Dependencies

- 현재 라우트와 레이아웃 경계 유지
- Mantine 전환 계획과 shared UI 도입
- product 문서의 near-term 정보 구조

## Exit Criteria

- 현재 라우트 의미를 바꾸지 않고도 페이지별 archetype이 문서와 코드에서 일관되게 설명된다.
- shared UI 계층 없이 새 화면을 만드는 관성이 줄어든다.
- `global.css`가 구조 책임을 과도하게 떠안지 않는다.
- placeholder 화면도 동일한 프론트 구조 규칙 아래에서 동작한다.
