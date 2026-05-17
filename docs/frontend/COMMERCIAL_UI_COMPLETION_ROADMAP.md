# Commercial UI Post-Completion Roadmap

Last updated: 2026-05-17

## Guardrails That Remain Active

- Keep Work Archive a personal local-first archive.
- Do not add authenticated direct-create paths.
- Do not introduce Community, public profile, public feed, follow, comment, or SNS work into this product phase.
- Preserve `WorkRecord`, sync queue, guest/account archive scopes, manual sync, and conflict UX.
- Extend Mantine theme and shared primitives before adding page-specific styling.
- Keep `global.css` limited to reset, typography, focus, shell padding, and reduced-motion rules.

## Completed For The Commercial UI Pass

- Product, account, auth, and minimal layouts are visually and structurally distinct.
- Main product navigation exposes Home, Works, Insights, lower-priority Tier Boards, account utilities, and persistent Add Work.
- Mobile navigation keeps Add Work reachable and moves account/theme utilities into mobile-safe structures.
- Home is a personal archive hub with search, add, recent records, continue actions, metrics, loading, empty, and recovery states.
- Works is a URL-backed media library with persistent search, collapsed advanced filters, removable active chips, active/trash scope, grid/list view, restore feedback, and progressive rendering for larger personal libraries.
- Add/Edit preserve title-only local-first save while making search-assisted candidate application, provider readiness, duplicate warning, cover fallback, and genre/tag chip inputs clearer.
- Detail prioritizes personal review/progress/timeline over metadata and separates destructive actions into a danger section.
- Insights presents local-first taste and record-health data with drill-down links back to Works and continue links back to stale records.
- Account/Profile wording is private-record and management focused, not public/social profile focused.
- Sync exposes pending, failed, conflict, merge, retry, local keep, and remote apply flows with clearer diagnostics.
- Settings summarizes provider readiness, user-key requirements, local archive safety, and session actions.
- Auth screens use focused form shells, contextual error copy, loading/disabled states, password recovery, and guest transfer recovery.
- Tier Boards and Community are clearly framed as prepared/out-of-scope surfaces rather than unfinished broken pages.
- Required validation commands pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

## Post-Completion Backlog

### Visual Regression

- Add automated browser visual regression after choosing a stable Playwright or equivalent workflow for this repo.
- Keep manual 320px/390px smoke checks for shell, Works, Add/Edit, Detail, Sync, Account, and placeholders until automated visual coverage exists.

### Large Library Performance

- Current UI uses progressive rendering for personal-library scale.
- If real user archives reach thousands of records, measure browser performance and evaluate full virtualization.

### Tier Boards

- Implement only as a personal organization tool, not as a public/social ranking surface.
- Keep it lower priority than Works, Detail, and Insights until the core record loop has production usage.

### Provider Reliability

- Continue to support direct local entry as the guaranteed path when external search providers fail.
- Add more provider-specific diagnostics only where they improve user recovery.

### Accessibility

- Periodically re-check drawer focus order, dialog focus return, keyboard-only filter removal, contrast, and touch target sizing after future UI changes.
