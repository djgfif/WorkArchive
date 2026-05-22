# FRONTEND_BLUEPRINT_V1.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `current frontend decisions` |
| Source of truth | `apps/web/src/app/router/routes.tsx`, current layout/page implementation, current auth/session data flow |
| Last verified against | `2026-04-24` working tree |
| When to update | 현재 라우트, 레이아웃 책임, 페이지 역할, 세션 저장 방식, placeholder 경계가 바뀔 때 |

이 문서는 Work Archive 프론트엔드의 **현재 canonical 기준**이다. 목표 비전이나 향후 리팩터링 계획이 아니라, 지금 코드에서 이미 고정된 UI/라우트/레이아웃 결정을 정리한다.

## 1. Current Baseline

- 현재 프론트는 local-first 기록 앱으로 동작한다.
- 메인 제품, 인증, 계정 관리, 최소 유틸리티가 서로 다른 레이아웃으로 분리돼 있다.
- 홈/작품/상세/추가/계정 흐름은 실제 사용 가능한 상태다.
- Mantine provider, theme, shared page wrapper는 이미 도입돼 있다.
- Quick Add는 현재 authenticated server search와 local-first save를 함께 사용한다.
- 다만 시각 책임은 아직 `global.css`와 페이지별 클래스 조합에 크게 남아 있다.
- 현재 저장소에서 실제 실행 가능한 프론트 런타임은 `apps/web`이며, Tauri는 future runtime 제약으로만 고려한다.

## 2. Canonical Layout Decisions

### Main Product Layout

담당 라우트:

- `/`
- `/works`
- `/works/new`
- `/works/:id`
- `/works/:id/edit`
- `/tier-boards`
- `/profile`

`/insights`와 `/community`는 현재 visible surface가 아니며, 호환 redirect만 유지한다.

역할:

- 메인 제품 탐색과 기록 흐름 제공
- 주요 내비게이션과 세션 상태 노출
- 홈, 작품, 프로필, 확장 목적지 수용

### Auth Layout

담당 라우트:

- `/auth/login`
- `/auth/register`

역할:

- 인증 전용 입력 흐름
- 메인 제품 셸과 시각적/맥락적으로 분리된 로그인 경험

### Account Layout

담당 라우트:

- `/account`
- `/account/sync`
- `/account/transfer`
- `/account/settings`

역할:

- 계정 개요, 동기화, 설정의 관리 맥락
- 로그인 직후 guest 기록 검토/가져오기 흐름 수용
- 메인 제품 목적지와 계정 관리 기능 분리

### Minimal Layout

담당 라우트:

- `*`

역할:

- 404 등 최소 유틸리티 화면 처리

## 3. Current Route Rules

### Compatibility Redirects

기존 진입 동선은 아래처럼 유지한다.

- `/sync` -> `/account/sync`
- `/settings` -> `/account/settings`
- `/profile/sync` -> `/account/sync`
- `/profile/settings` -> `/account/settings`

### Navigation Labels

현재 메인 내비게이션은 아래 항목을 기준으로 한다.

- 홈
- 작품
- 티어 보드
- 프로필

이 명칭은 현재 visible navigation 기준이다. 제품 용어 변경은 roadmap 문서에서 다루고, 이 문서는 코드에 반영된 명칭을 따른다.

## 4. Current Page Roles

| Page | Current role |
| --- | --- |
| Home | 검색, 빠른 추가, 통계, 최근 기록을 묶는 허브 |
| Works | 목록/필터/정렬/휴지통을 포함한 관리 워크스페이스 |
| Work Create | 검색과 자동 채움 검토 중심의 Quick Add 플로우 |
| Work Detail | 개인 감상 기록 확인 중심의 디테일 페이지 |
| Work Edit | 기록 수정 플로우 |
| Auth | 입력 집중형 인증 페이지 |
| Account | overview / sync / settings / guest transfer review 중심 관리 페이지 |
| Tier Boards | 작품 기록과 분리된 독립 보드 기능 |
| Insights | 현재 미노출. 개인 기록 통계 계획 문서 기준으로 후속 구현 |
| Community | 현재 범위 밖. visible navigation과 현재 기능 설명에서 제외 |

## 5. Current Data And Session Rules

- IndexedDB가 프론트의 1차 저장소다.
- DB는 `works`, `releaseRecords`, `syncQueue`, `appMeta` 테이블을 사용한다.
- 게스트와 로그인 사용자는 서로 다른 로컬 아카이브를 사용한다.
- sync는 계정 모드에서만 수동 실행한다.
- 인증은 현재 이메일/비밀번호 기반이다.
- access token은 `localStorage`에 저장한다.
- refresh token은 JS가 직접 읽지 않고 cookie로만 사용한다.
- 인증 API 호출은 `credentials: 'include'`를 사용한다.
- Quick Add는 authenticated 상태에서 `/imports/search`를 사용하고, 저장은 계속 Dexie local-first create를 유지한다.
- 로그인 직후 guest 기록이 감지되면 `/account/transfer`에서 중복 후보를 먼저 검토한다.

## 6. Current UI Constraints

- Mantine provider/theme와 shared primitives는 이미 도입됐다.
- 공용 UI 계층보다 페이지별 CSS 조합 의존이 크다.
- `var(--accent)`와 같은 전역 CSS 변수 직접 참조가 여전히 넓게 남아 있다.
- placeholder 화면과 실제 구현 화면의 완성도 차이가 있다.
- 따라서 프론트 roadmap 문서는 이 기준을 깨지 않으면서 구조를 정리하는 방향으로 읽어야 한다.
