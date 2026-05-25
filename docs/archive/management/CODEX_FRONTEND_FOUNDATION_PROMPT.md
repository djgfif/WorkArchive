# CODEX_FRONTEND_FOUNDATION_PROMPT.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `execution prompt` |
| Source of truth | [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md), [`../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md`](../frontend/FRONTEND_FOUNDATION_MASTERPLAN.md), [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md), current `apps/web` tree |
| Last verified against | `2026-04-22` working tree |
| When to update | 프론트 foundation 우선순위, shared UI 기준, route ownership 제약, 검증 요구가 바뀔 때 |

이 문서는 Work Archive 프론트의 **foundation refactor를 Codex에 위임할 때 그대로 붙여 넣어 쓸 수 있는 실행 프롬프트**다. 새 디자인 제안용이 아니라, 현재 구조를 안전하게 정리하는 작업용이다.

## When To Use

- 프론트 foundation을 먼저 다지고 싶을 때
- `global.css` 책임을 줄이고 싶을 때
- shared primitives를 기본 경로로 고정하고 싶을 때
- Home / Works / Work Detail / Auth / Account를 구조적으로 정리하고 싶을 때

## What This Prompt Optimizes For

- 유지보수성
- 확장성
- 반복 업데이트 안전성
- route 의미 보존
- local-first / guest-user 분리 보존
- flashy redesign보다 구조 개선 우선

## Paste This Prompt

```text
You are working in the WorkArchive repository.

Your mission is to harden the frontend foundation first, prioritizing maintainability, extensibility, and safe future refactors over visual novelty or feature expansion.

Read these files first and treat them as primary instructions before editing anything:

1) docs/frontend/FRONTEND_BLUEPRINT_V1.md
2) docs/frontend/FRONTEND_FOUNDATION_MASTERPLAN.md
3) docs/frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md
4) apps/web/src/app/router/routes.tsx
5) apps/web/src/main.tsx
6) apps/web/src/app/mantine-theme.ts
7) apps/web/src/app/styles/global.css
8) apps/web/src/shared/components/AppPrimitives.tsx
9) apps/web/src/shared/components/PageTemplates.tsx
10) apps/web/src/shared/components/PageHero.tsx
11) apps/web/src/shared/components/FutureFeaturePage.tsx

Treat the following constraints as non-negotiable:

- Preserve current route ownership and route meaning.
- Do not redesign the information architecture.
- Do not introduce unrelated new features.
- Keep the existing local-first model intact.
- Do not break guest archive vs authenticated user archive separation.
- Treat Mantine as an already adopted foundation, not a new experiment.
- Reduce global.css responsibility.
- Make shared UI primitives the default path for future screens.
- Optimize for repeated future updates and safe refactors.
- Prefer evolving the existing shared UI layer over creating a parallel abstraction layer.
- If you introduce a new shared primitive, use it immediately in at least two real places in this pass, or do not introduce it.

Project facts you must respect:

- The route/layout split is already established and should remain stable.
- Main route meanings are already fixed: Home, Works, Work Create, Work Detail, Auth, Account.
- MantineProvider and appTheme are already wired in apps/web/src/main.tsx.
- Shared primitives already exist in apps/web/src/shared/components and should be strengthened, not bypassed.
- IndexedDB/Dexie local-first storage is already real and guest/user archives are intentionally separated.
- Placeholder destinations like Tier Boards / Insights / Community must stay structurally consistent with the main frontend system.
- The current problem is not “missing Mantine”; the problem is that global.css and page-specific class combinations still own too much styling and structure.

Scope for this pass:

- Focus only on frontend foundation work.
- Do not do backend work.
- Do not do feature expansion.
- Do not change API contracts.
- Do not edit docs unless absolutely necessary to keep code accurate after the refactor.
- Prefer changes inside apps/web/src/app, apps/web/src/shared/components, and the relevant apps/web/src/features frontend files only.

Primary goals:

1. Shrink global.css into minimal global rules, resets, accessibility/focus helpers, and rare layout/media fallbacks.
2. Make apps/web/src/app/mantine-theme.ts the source of truth for visual tokens.
3. Establish or strengthen a shared UI layer for:
   - page shell
   - page header / hero
   - section card
   - empty / loading / error state
   - stat card
   - action / filter bar
4. Refactor core pages to rely more on shared primitives and less on page-specific class combinations.
5. Keep placeholder pages inside the same frontend system instead of ad-hoc styling.
6. Prefer centralizing tokens and component defaults in theme/components over ad-hoc CSS variables and one-off page classes.

Priority order:

1. Foundation and shared primitives
2. Home
3. Works
4. Work Detail
5. Auth
6. Account / Sync / Settings

Do not spend time polishing secondary placeholders before the core surfaces are structurally improved.
If everything cannot be completed safely in one pass, fully complete the earlier priorities first instead of scattering shallow edits across all pages.

Required working style:

- Inspect the current frontend tree before editing.
- Start with a short audit of current frontend foundation problems, using the actual codebase.
- Then make a concrete implementation plan.
- Then apply changes in small, coherent steps.
- Prefer improving architecture over cosmetic churn.
- Prefer reusable primitives over one-off page fixes.
- Preserve behavior unless a behavior change is necessary for consistency or maintainability.
- If something is ambiguous, choose the option that lowers future change cost.
- When choosing between “move style responsibility into theme/shared primitives” vs “add another page-specific class”, choose the former.
- Do not replace stable route semantics.
- Do not over-engineer abstractions with no immediate usage.

Implementation guidance:

- Reuse and strengthen the existing shared layer in apps/web/src/shared/components before creating anything new.
- Push visual tokens into apps/web/src/app/mantine-theme.ts and Mantine component defaults where practical.
- Reduce direct use of global CSS variables like var(--accent), var(--text-primary), var(--text-muted) inside shared components when theme-driven alternatives are clearer.
- Reduce reliance on global classes such as primary-link, secondary-link, panel, badge-row, detail-list, home-*, detail-*, and work-card-* where shared primitives or Mantine components can take over.
- Keep Work Detail content-first: my review and reading flow should remain more important than raw metadata.
- Keep placeholder pages consistent with the same templates/primitives rather than custom ad-hoc sections.
- Avoid rewriting large areas just for style churn if the structural payoff is low.

Required deliverables:

1. A short written audit of the current frontend foundation problems.
2. A concrete refactor plan aligned to the docs.
3. Actual code changes in apps/web.
4. A concise summary of what changed and why.
5. Follow-up recommendations for the next refactor slice.

Verification requirements:

- Run targeted frontend verification after changes.
- At minimum run:
  - npm run typecheck --workspace @work-archive/web
  - npm run test --workspace @work-archive/web
- If a test fails because of the refactor, fix it or explain exactly why it is out of scope.
- In the final summary, explicitly state whether route meaning, local-first behavior, and guest/auth archive separation were preserved.

Acceptance criteria:

- global.css is clearly smaller in responsibility.
- theme/token ownership is clearer and more centralized.
- shared primitives are more obviously the default path for new screens.
- Home / Works / Work Detail / Auth / Account move toward explicit page archetypes.
- no route meaning is broken.
- no local-first archive behavior is broken.
- the result is easier to extend safely than before.

Important:

- Do not stop at a high-level review only.
- Do not perform a broad speculative redesign.
- Do not replace stable route semantics.
- Do not over-engineer abstractions with no immediate usage.
- Do not optimize for flashy visuals over maintainable structure.
```

## Success Signals

- 첫 응답에서 `AppPrimitives`, `PageTemplates`, `mantine-theme.ts`, `global.css`의 역할 충돌을 직접 언급한다.
- 구현 범위를 `apps/web` 중심으로 유지한다.
- placeholder polishing보다 foundation과 core surfaces를 먼저 끝낸다.
- 최종 보고에 `typecheck`, `test`, route meaning 보존, guest/auth archive 분리 보존 여부가 포함된다.

## Follow-Up Use

다음 단계에서는 이 프롬프트를 바탕으로 아래처럼 더 잘게 나눌 수 있다.

- foundation slice 전용
- Home / Works slice 전용
- Work Detail / Auth / Account slice 전용
