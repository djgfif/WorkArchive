# Commercial UI Completion Audit

Last reviewed: 2026-05-17

## Scope And Design Source

This audit covers the current React/Mantine web app in `apps/web`: Home, Works, Work Detail, Add/Edit, Insights, Account, Sync, Settings, Auth, Tier Boards, and Community.

Stitch was available and reviewed through the connected `WorkArchive IA v1` and prior Work Archive design system projects. The implementation follows the existing Stitch direction: personal archive first, quiet commercial app shell, dense but readable library views, local-first save clarity, and no public/community plane in this phase.

## Product Friction Summary

- First-run comprehension is close, but the previous global navigation over-emphasized Home/Works/Profile while hiding Insights, Sync, and Settings behind route knowledge.
- The library already preserves filters in the URL, but applied filters were not summarized as removable chips, so users had to inspect every control to understand why a result set was narrow.
- Delete actions were technically soft-delete, but the UI did not clearly say that records can be restored from trash after deletion.
- Add Work had the right direct/search split, but imported candidate feedback did not clearly show which fields were filled and which personal fields still needed user input.
- Edit had a usable full form, but genre/tag comma inputs did not provide a chip-like confirmation of what would be saved.
- Detail already prioritizes personal review/progress above metadata, but destructive actions were still grouped with primary review/edit CTAs.
- Insights had real aggregation, but much of it read as flat card lists rather than an exploratory taste dashboard.
- Account/Profile wording still implied future public profile concepts in places. For this product phase, account should mean sync/settings/data management, not social identity.
- Tier Boards and Community are correctly not implemented as public features. Community needs to remain explicit that it is intentionally out of scope, not an unfinished core tab.

## Route And Navigation Audit

Current route surface:

- Core: `/`, `/works`, `/works/new`, `/works/:id`, `/works/:id/edit`
- Discovery/analysis: `/insights`, `/tier-boards`
- Account plane: `/account`, `/account/sync`, `/account/settings`, auth routes
- Out of scope: `/community`

Recommended exposure policy:

- Main product navigation: Home, Works, Insights, Tier Boards.
- Account utility navigation: Account, Sync, Settings.
- Global persistent CTA: Add Work.
- Community: do not expose in global navigation. Keep route-level explanation only.

## Screen Findings

### Home

- Strength: search, quick add, recent records, and summary metrics exist.
- Risk: home copy should stay centered on “personal records saved locally first,” especially for guest users.
- Improvement: keep recent/continue/action blocks above any secondary product explanation.

### Works

- Strength: URL-backed search, status, type, tag, sort, scope, and view mode already exist.
- Risk: filter state was visually implicit.
- Improvement: applied chips with individual remove actions, clearer restore-after-delete feedback, and better mobile wrapping.

### Add / Edit

- Strength: title-only save path is preserved; search is optional fill assistance; provider readiness and duplicate detection exist.
- Risk: users could apply a candidate without knowing which personal record fields remain blank.
- Improvement: show filled/missing field summary, cover fallback preview, and chip previews for comma-separated genre/tag fields.

### Work Detail

- Strength: personal review, quick record, progress, timeline, release records, related metadata all exist.
- Risk: delete sat next to primary review/edit actions.
- Improvement: separate destructive actions into a danger management section and explain trash restore behavior.

### Insights

- Strength: actual local-first aggregate service exists.
- Risk: lists were useful but not as scannable as a commercial dashboard.
- Improvement: use progress/list combinations and stronger “personal-only dashboard” framing.

### Account / Sync / Settings

- Strength: account center, sync dashboard, provider readiness, local archive import/export, and sessions are present.
- Risk: account/profile language could be mistaken for public profile/community direction.
- Improvement: describe account as data management, sync, backup, provider, and settings plane.

### Auth

- Strength: auth routes use focused templates and do not replace local-first saving.
- Risk: guest/account archive transfer remains a high-trust flow and needs continued copy precision.

### Tier Boards / Community

- Tier Boards can remain a next-step personal organization placeholder.
- Community must remain out of global nav and explain that public SNS features are intentionally outside the current product scope.

## Accessibility And Responsive Risks

- Mobile nav needed direct access to account/sync/settings and the Add Work CTA.
- Filter controls needed removable active states with accessible names.
- Destructive actions needed clearer labels and surrounding explanation.
- Long Korean labels in compact controls remain a regression risk; verification should include 320px and tablet widths.
- Loading states are serviceable but should continue moving toward skeletons for dense library/detail surfaces.

## Verification Targets

- Main navigation renders Home, Works, Insights, Tier Boards, Account, Sync, Settings, and Add Work.
- Works filter URL preservation still passes.
- Works view mode URL preservation still passes.
- Empty states remain distinct for no records, no search results, and empty trash.
- AddWorkFlow title validation and candidate form reflection still pass.
- Detail delete remains soft-delete and routes back to Works.
