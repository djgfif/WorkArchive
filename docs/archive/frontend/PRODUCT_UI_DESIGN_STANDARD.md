# Product UI Design Standard

Last updated: 2026-05-17

## Product Character

Work Archive is a personal local-first archive for recording works, progress, ratings, reviews, and taste patterns. It is not a public SNS, community feed, catalog clone, or decorative showcase. The interface should feel like a dependable daily service: quiet, information-rich, fast to scan, and clear about what is saved locally versus synced to an account.

## Screen Archetypes

- Home: personal archive hub. Search, add, continue, recent records, and meaningful summary come before product explanation.
- Works: media library workspace. Search is primary, filters are understandable, grid feels like a library, list feels like a management surface.
- Create/Edit: guided record flow. Title-only save stays fast; search is optional enrichment; personal record fields are visibly separate from imported metadata.
- Detail: personal record dossier. My status, rating, progress, review, timeline, and notes outrank metadata and related catalog information.
- Insights: personal taste dashboard. Numbers must explain what they mean and suggest next actions.
- Account: settings/control center. Sync, sessions, provider settings, import/export, and account state live here.
- Auth: focused entry flow. Login/register/reset are calm, trustworthy forms that do not erase guest/local-first understanding.
- Placeholder: honest product boundary. Future or out-of-scope features must explain status and offer a useful alternative action.

## Color Use

- Use `mantine-theme.ts` and CSS variables as the source of truth.
- `archive` is the product accent for primary CTA, selected states, active nav, and meaningful highlights.
- Red is reserved for destructive actions or blocking errors.
- Teal/success is reserved for completed/success feedback.
- Yellow/warning is reserved for conflict, attention, or provider readiness states.
- Avoid page-level one-off palettes, decorative gradient backgrounds, and color as the only state signal.

## Surface Hierarchy

- Shell background: app context.
- `SectionCard tone="default"`: primary content section.
- `SectionCard tone="subtle"`: secondary control, settings, supporting state, or grouped rows.
- `SectionCard tone="hero"`: first screen summary only, not generic decoration.
- Cards must not be nested for decoration. Nested surfaces are allowed only for repeated rows, form previews, queue items, or true sub-records.
- `global.css` stays limited to reset, typography, focus, shell padding, and reduced motion.

## Button Hierarchy

- Primary: one dominant next action per section, usually add, save, sync, continue, or review.
- Secondary/default: neutral navigation or supporting action.
- Quiet/ghost: low-emphasis actions such as cancel, return, reveal filters, or reset.
- Danger: destructive or potentially risky actions only.
- Loading buttons must be disabled or show Mantine loading state to prevent duplicate submit.

## Badge And Status Hierarchy

- `AppBadge tone="accent"`: active, selected, current, or important product state.
- `muted`: metadata, inactive status, or informational tags.
- `success`: completed/synced/saved.
- `warning`: conflict, provider action required, or attention.
- `danger`: failed, destructive, or blocking status.
- Badge text should be short and stable. Do not encode long explanations inside badges.

## Typography Scale

- H1 is reserved for page identity or first-viewport hero.
- H2/H3 are section headings and card headings.
- Compact controls, rows, cards, and nav must use small but readable text, not hero-scale type.
- Letter spacing remains `0` except short uppercase eyebrow labels already established in primitives.
- Long titles, emails, tags, and reviews must wrap or clamp without breaking layout.

## Spacing And Density

- Product pages should feel usable, not sparse marketing pages.
- Forms and dashboards use `gap="md"` or `gap="lg"` depending on complexity.
- Library rows and card grids should preserve stable poster aspect ratios and predictable controls.
- Account/settings can be denser than Home but should still show section purpose and next action.

## State Rules

- Loading: use structured skeleton/placeholder patterns for list, dashboard, detail, and sync surfaces.
- Empty first-use: explain how to start and show a strong CTA.
- Empty filtered result: explain that filters/search caused the empty state and offer reset.
- Empty trash: explain that deleted records will appear there and offer active list return.
- Empty insights: guide users to add works, ratings, tags, or reviews.
- Error: show the problem and the next viable action; do not stop at “문제 발생”.
- Success: confirm the action and offer next steps when the user remains on the page.
- Dangerous action: use confirm and explain restore/undo if available.

## Feedback Policy

- Use `FeedbackMessage` as the default feedback surface for submit, save, delete, restore, sync, and provider-key actions.
- Keep feedback inline on the page or panel where the user acted. Do not introduce global toast/notification behavior unless it has a clear cross-route purpose.
- Error feedback uses `role="alert"` and must include the next viable action when the user cannot recover by simply editing the current form.
- Success feedback uses `role="status"` and should either auto-clear after a short interaction window or remain attached to the resulting state when it confirms navigation or a completed workflow.
- Avoid stacking multiple success messages for repeated quick actions. Replace the previous inline message with the latest action result.
- Delete and restore feedback must explicitly state whether the record is hidden, recoverable, restored, or permanently outside the current flow.

## Mobile Rules

- 320px is a supported width.
- Global nav uses drawer on mobile; Add Work remains reachable.
- Search remains visible in Works; advanced filters may be collapsed.
- Button touch targets should stay comfortable and not depend on tiny symbols alone.
- Poster grids should not truncate all useful metadata; list rows may wrap controls below content.
- Long Korean titles, tags, emails, and review text must not cause horizontal scroll.

## Accessibility Criteria

- Every major button needs an accessible name.
- Icon-only or symbol-heavy buttons require `aria-label` and `aria-pressed` when toggle-like.
- NavLink active state must rely on React Router `aria-current` plus visible active styling.
- Dialog, Menu, Accordion, Collapse, and Drawer must remain keyboard-operable through Mantine defaults.
- `:focus-visible` must stay visible globally.
- State that uses color must also use text labels.
- `respectReducedMotion` in Mantine theme and the reduced-motion global rule must remain enabled.

## Shared Component Usage

- `PageShell`: page width and vertical rhythm.
- `PageHero`: page identity, short context, top actions, and meta pills.
- `SectionCard`: durable content surface; avoid page-specific decorative classes.
- `SurfaceLinkCard`: clickable card with clear destination.
- `AppButton` / `AppLinkButton`: button tone source of truth.
- `AppBadge`: status and metadata tone source of truth.
- `StateMessage`: empty, error, and guidance states.
- `FeedbackMessage`: inline feedback for submit, delete, sync, and restore.
- `LoadingState` / `LoadingRows`: structured loading for commercial-feeling wait states.
- `MetricPill`: compact numbers with labels, never unexplained statistics.
- `PageTemplates`: maintain archetype-specific page widths and rhythm.

## Route And Navigation Policy

- Main product nav: Home, Works, Insights, and lower-priority Tier Boards with “준비 중”.
- Persistent CTA: Add Work.
- Account utility nav: Account, Sync, Settings.
- Community remains out of primary navigation and clearly out of scope.
- Profile is personal-only and must not imply public social features.

## Completion Bar

A screen is commercially acceptable only when the user can answer these questions without guessing:

- Where am I?
- What record or setting is this about?
- What can I do next?
- What is currently loading, empty, failed, saved, deleting, restoring, pending, failed to sync, or conflicted?
- What happens if I leave this page or refresh the URL?
