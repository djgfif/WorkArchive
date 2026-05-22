# STITCH_TO_PRODUCT_EVOLUTION_PLAN.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `Stitch reference translation plan` |
| Source of truth | `docs/design/DESIGN.md`, `docs/design/stitch/*`, current `apps/web` implementation |
| Last verified against | `2026-04-27` IA v1 Stitch reference + modal-first Add implementation |
| When to update | new Stitch drafts are added, design direction changes, or implementation scope changes |

이 문서는 Google Stitch로 만든 시안을 Work Archive 실제 웹 UI에 반영할 때의 기준 문서다. Stitch 결과물을 그대로 붙여 넣는 것이 아니라, **장점만 추출해서 현재 Mantine + AppPrimitives 기반 디자인 시스템으로 재구현**하는 것이 목적이다.

## 1. Core Principle

```text
Stitch는 시각 탐색 도구이고, `docs/design/DESIGN.md`는 공식 디자인 계약이며, apps/web은 실제 구현이다.
```

따라서 Stitch 시안은 다음 역할만 가진다.

- 화면 정보 구조 아이디어 제공
- 카드 밀도와 시각 계층 참고
- 포스터 중심 레이아웃 참고
- 검색/필터/진행 상태 표현 방식 참고
- 프리미엄 아카이브 무드 탐색

Stitch 시안은 다음을 직접 결정하지 않는다.

- 실제 라우팅 구조
- local-first 저장 정책
- sync 정책
- 커뮤니티/public catalog 경계
- React/Mantine 컴포넌트 구조
- 공식 디자인 토큰

## 1-1. IA v1 Stitch Application

`WorkArchive IA v1` Stitch pass는 Add Work, Library, Work Detail, Backup/Restore, Sync, Insights의 화면 위계 참고용으로 사용했다. 실제 구현은 Stitch HTML을 붙여 넣지 않고 Mantine + AppPrimitives로 재구현한다.

반영된 기준:

- `/works`의 작품 추가는 `AddWorkDialog` 중심으로 열고, `/works/new`는 page fallback으로 유지한다.
- 검색 후보 선택은 중첩 modal이 아니라 creation flow 내부의 `SearchPickerPanel` master-detail 영역으로 다룬다.
- Work Detail은 작품 소개보다 `내 기록`과 `personalTags`를 먼저 읽히게 한다.
- Settings 백업/복구와 Sync 상태 화면은 기능 추가 없이 정책 설명과 상태 구분을 명확히 한다.

## 2. What To Extract From Stitch

### 2-1. Poster-led hierarchy

Stitch 시안의 가장 큰 장점은 작품 표지와 카드 밀도를 통해 “개인 아카이브”의 시각적 정체성을 강화한다는 점이다.

적용 방향:

- 작품 목록 grid는 포스터 중심으로 더 촘촘하게 만든다.
- 홈의 최근 기록은 대표 카드 + 보조 카드의 bento 구조를 검토한다.
- 이미지가 없는 작품은 typographic fallback을 유지한다.
- 포스터가 시각적 에너지를 담당하고 UI chrome은 차분하게 유지한다.

### 2-2. Bento and dashboard-like scanning

홈 시안의 Recent Records bento 구조는 기존 홈보다 재진입성이 좋다. 단, 전체 shell을 dashboard처럼 바꾸면 product tone이 흐려질 수 있다.

적용 방향:

- HomePage에서 최근 기록 1개를 lead card로 강조한다.
- 다음 최근 기록 2개를 작은 poster card로 배치한다.
- In Progress / 이어보는 중 섹션을 추가한다.
- 기존 PageHero와 검색 CTA는 유지한다.

### 2-3. Dense Works grid

작품목록 시안은 현재 기능 구조와 잘 맞는다. 검색, 필터, view switcher, grid/list, 상태 badge, 포스터 카드가 모두 작품 탐색 화면의 핵심이다.

적용 방향:

- Works grid를 4~5열까지 확장한다.
- 상태 badge를 포스터 오버레이로 표시한다.
- 타입 필터는 chip/button group 형태를 검토한다.
- 정렬은 select 유지 가능하다.
- list view는 기능성 중심으로 유지한다.

### 2-4. Quick Add split flow

작품 추가 시안은 현재 Quick Add 기능 구조와 가장 잘 맞는다. 현재 구현도 검색, 후보 선택, 중복 확인, 선택 작품 확인, 개인 기록 입력, 고급 정보, local-first 저장으로 구성되어 있으므로, Stitch 시안의 장점은 주로 **시각적 명확성**과 **입력 우선순위**다.

적용 방향:

- 왼쪽은 검색과 후보 선택, 오른쪽은 선택 작품 preview와 개인 기록 입력으로 유지한다.
- 후보 row를 더 카드형으로 만들고 선택 상태를 border/background로 명확히 표현한다.
- 선택 작품 preview는 포스터를 더 크게 보이고 제목, type/source/year/contributor를 상단에 정리한다.
- 상태 입력은 select보다 button group 또는 segmented control을 검토한다.
- 저장 CTA는 더 강하게, 가능하면 full-width로 표시한다.
- 한줄평과 상세 감상은 핵심 입력으로 유지한다.
- 고급 정보는 accordion/disclosure로 유지한다.

절대 변경하지 않을 것:

- `catalogTitleId` / identity-only `importDraft` 계약
- duplicate detection과 duplicate confirmation
- manual/preview candidate fallback
- Dexie, syncQueue, local-first save
- backend sync behavior

### 2-5. Progress visibility

Stitch의 In Progress row는 현재 기록 앱의 “이어보기” 목적에 잘 맞는다.

적용 방향:

- 진행 중인 작품을 홈에서 별도 섹션으로 노출한다.
- `progressCurrent / progressTotal`이 있으면 progress bar를 표시한다.
- 값이 없거나 0이면 깨지지 않게 상태 badge 중심으로 fallback한다.

### 2-6. Quiet premium mood

Stitch가 준 장점은 어두운 shell, 포스터, 얇은 border, archive-blue accent의 조합이다.

적용 방향:

- shadow가 아니라 border와 surface contrast로 depth를 만든다.
- archive blue는 active/accent 역할로 제한한다.
- pure black이나 강한 glassmorphism은 피한다.
- 한국어 UI와 현재 typography stack을 유지한다.

## 3. What Not To Copy

다음은 Stitch 시안에서 직접 가져오지 않는다.

- Tailwind HTML 구조
- 좌측 사이드바 shell
- 상단 TopAppBar 전면 교체
- Material Symbols 의존
- Inter / Work Sans font stack
- 영어 IA / 영어 copy
- Material-style color token explosion
- pure black sidebar
- 과한 backdrop blur / glass 효과
- smaller Tailwind radius scale
- server-first 저장처럼 보이는 흐름
- community/public catalog promotion을 기본 저장 흐름처럼 보이게 하는 UI
- 실제 기능 없는 password recovery, remember-me, markdown 지원 문구

## 4. Translation Rules

Stitch 시안을 실제 코드로 옮길 때는 아래 순서를 따른다.

1. Stitch HTML에서 화면 목적과 정보 구조만 추출한다.
2. 현재 `docs/design/DESIGN.md`의 토큰과 원칙에 맞게 다시 해석한다.
3. `apps/web`에서는 Mantine + shared primitives로 재구현한다.
4. 기존 routing, state, local-first save, syncQueue 흐름은 건드리지 않는다.
5. 테스트로 기존 기능이 깨지지 않았음을 확인한다.

우선 사용하는 컴포넌트:

- `PageHero`
- `SectionCard`
- `PageSection`
- `ArtworkPoster`
- `AppBadge`
- `AppButton`
- `AppLinkButton`
- `MetricPill`
- Mantine `SimpleGrid`, `Stack`, `Group`, `Paper`, `TextInput`, `NativeSelect` 등

## 5. Surface-specific Direction

### HomePage

Reference:

- `docs/design/stitch/home/2026-04-24-home-premium-archive.html`
- `docs/design/stitch/home/2026-04-24-home-premium-archive.notes.md`

Extract:

- Recent Records bento layout
- large lead recent card
- small supporting recent cards
- In Progress / 이어보는 중 section
- progress bars
- poster hover emphasis

Do not extract:

- sidebar
- topbar rewrite
- English IA
- Tailwind token system

Implementation target:

- Keep current `MainProductLayout`.
- Keep current `PageHero` and search entry.
- Improve recent-record and in-progress visual hierarchy.

### WorksListPage

Reference:

- `docs/design/stitch/works/2026-04-24-works-list-premium-grid.html`
- `docs/design/stitch/works/2026-04-24-works-list-premium-grid.notes.md`

Extract:

- poster-dense grid
- status badge overlay
- compact view switcher
- type filter chips
- typographic fallback
- list/grid parity

Do not extract:

- sidebar
- fixed topbar rewrite
- Material Symbols dependency
- generic media categories that do not match actual WorkArchive types

Implementation target:

- Improve `WorkCard` grid density.
- Keep `WorksToolbar` behavior.
- Keep list view quick update behavior.
- Preserve trash scope and filters.

### QuickAdd / WorkCreatePage

Reference:

- `docs/design/stitch/quick-add/2026-04-24-quick-add-split-flow.html`
- `docs/design/stitch/quick-add/2026-04-24-quick-add-split-flow.notes.md`

Extract:

- split search/results and selected-record form layout
- stronger candidate cards
- active selected candidate state
- larger selected-work preview header
- status button group
- stronger save CTA
- advanced fields kept behind accordion/disclosure

Do not extract:

- sidebar
- topbar rewrite
- Material Symbols dependency
- mock data
- English labels
- markdown-supported claim unless implemented
- any data behavior change

Implementation target:

- Improve `QuickAddWorkForm` presentation and support the modal-first AddWorkDialog plus `/works/new` fallback.
- Preserve search, selection, duplicate, identity, and save behavior.
- Keep current saved-work success flow in `WorkCreatePage`.

### Auth

Reference:

- `docs/design/stitch/auth/2026-04-24-auth-clean-archive-card.html`
- `docs/design/stitch/auth/2026-04-24-auth-clean-archive-card.notes.md`

Extract:

- centered auth card
- compact brand mark
- focused one-column form
- full-width submit
- clear login/register/guest footer links

Do not extract:

- Material Symbols dependency
- external background image
- remember-me or password recovery without real behavior

Implementation target:

- Simplify `AuthPageTemplate` without changing auth behavior.

## 6. Recommended Implementation Order

```text
1. Store and document Stitch references.
2. Improve Auth centered card because it is the safest UI uplift.
3. Stabilize IA v1 AddWorkDialog / SearchPickerPanel browser QA.
4. Improve Quick Add candidate cards and selected-work preview.
5. Improve Works grid card density and poster-first scanning.
6. Add status badge overlay to grid cards.
7. Improve Home recent-record bento section.
8. Add Home in-progress section.
9. Review visual consistency against `docs/design/DESIGN.md`.
```

## 7. Codex Guardrails

When giving Codex a Stitch-related task, include these guardrails:

```text
Do not paste Tailwind HTML directly.
Do not introduce sidebar navigation in this pass.
Do not replace MainProductLayout.
Do not change local-first save, Dexie, syncQueue, or backend sync behavior.
Do not add Material Symbols as a product dependency.
Use Mantine + AppPrimitives + `docs/design/DESIGN.md` tokens.
Keep Korean copy and WorkArchive domain language.
```

## 8. Success Criteria

A Stitch-inspired implementation is successful only if:

- the page feels more visual and easier to scan;
- current product behavior is unchanged;
- implementation uses existing components and tokens;
- tests for filtering, view switching, navigation, and local-first flows still pass;
- the result still feels like a personal archive, not a generic media dashboard.
