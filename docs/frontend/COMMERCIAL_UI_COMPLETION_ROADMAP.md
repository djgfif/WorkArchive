# Commercial UI Completion Roadmap

Last updated: 2026-05-17

## Product Guardrails

- Keep Work Archive a personal local-first archive.
- Do not add authenticated direct-create paths.
- Do not introduce Community/public SNS work into this completion phase.
- Preserve `WorkRecord`, sync queue, guest/account archive scopes, manual sync, and conflict UX.
- Extend Mantine theme and shared primitives before adding page-specific styling.
- Keep `global.css` limited to reset, typography, focus, shell padding, and reduced-motion rules.

## Completed In This Pass

- App Shell now exposes the main product destinations and the account utility plane.
- Add Work remains a persistent CTA on desktop and mobile.
- Mobile navigation includes Home, Works, Insights, Tier Boards, Account, Sync, Settings, theme, auth, and Add Work.
- Works toolbar summarizes active filters as removable chips while preserving URL query behavior.
- Soft-delete feedback now says the record moved out of the active list and can be restored from trash, with an inline undo action.
- Add Work search candidate application now summarizes filled fields and personal fields still worth completing.
- Add/Edit forms show cover fallback preview and chip-like genre/tag previews.
- Work Detail separates destructive delete from primary review/edit actions.
- Insights uses more progress/list structure and clarifies that only personal local archive data is counted.
- Account copy now avoids public profile/community implications.
- Community remains route-only and explicitly out of scope.

## Next Milestones

### 1. Visual QA And Density

- Check desktop, tablet, and 320px mobile for header wrapping, drawer usability, library filters, list rows, and detail action areas.
- Replace dense loading text in Works and Detail with structured skeletons.
- Review all inline flex/grid style blocks and migrate repeated patterns into shared primitives only where repetition is real.

### 2. Works Library Deepening

- Add focused tests for active filter chip removal.
- Add a compact “saved view” affordance only after the current URL-state model remains stable.
- Consider virtualized list rendering if real local libraries exceed several thousand records.

### 3. Add/Edit Flow Refinement

- Convert genre/tag text inputs into true token inputs if Mantine combobox behavior can be introduced without disrupting existing parse logic.
- Add toast-style success feedback where save actions currently route immediately.
- Keep direct title-only save as the fastest path.

### 4. Detail Record Experience

- Add collapsible defaults for timeline/release/related sections after measuring scroll length on real records.
- Add a visible “last saved” confirmation for quick record/progress/timeline writes.
- Keep external metadata below personal record content.

### 5. Insights

- Add drill-down links from media/status/rating rows into `/works` query URLs.
- Add “stale works” action filters to help users resume or clean up paused records.
- Keep all calculations local-first and personal-only.

### 6. Accessibility

- Audit drawer focus order, menu focus return, dialog focus, and keyboard-only filter removal.
- Check contrast for archive accent badges in light and dark modes.
- Ensure touch targets in mobile toolbar and list actions stay at least 40px high.

### 7. Tests

- Keep the required root commands green: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Maintain web tests for URL filter preservation, view mode preservation, empty state branches, AddWorkFlow title validation, candidate form reflection, and navigation link rendering.
- Add visual regression or Playwright smoke coverage once a stable dev-server workflow is selected for this repo.

## Remaining Limits

- Tier Boards still has no production implementation. It is intentionally framed as a next personal organization step.
- Community remains intentionally outside the product surface.
- Search providers can still fail due to external credentials or server availability; Add Work must continue to make direct local entry obvious.
