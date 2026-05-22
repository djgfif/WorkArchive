# Quick Add Split Flow Stitch Draft

| Field | Value |
| --- | --- |
| Status | `reference-only` |
| Role | `work creation / quick add visual exploration` |
| Source of truth | Google Stitch output, `docs/design/DESIGN.md`, current `WorkCreatePage` and `QuickAddWorkForm` implementation |
| Last reviewed | `2026-04-24` |
| When to update | this Stitch draft is re-generated, implemented, superseded, or rejected |

## Status

Reference only. Do not copy the generated Tailwind HTML directly into `apps/web`.

This draft explores a stronger split-flow layout for adding a new work. It is highly applicable because the current Quick Add implementation already has the same underlying flow: search, candidate selection, duplicate check, metadata confirmation, personal record input, advanced fields, and local-first save.

## Source

Generated with Google Stitch.

Stored reference:

- [`2026-04-24-quick-add-split-flow.html`](./2026-04-24-quick-add-split-flow.html)

## Design Value

The draft improves the perceived clarity of the add flow. It makes the left side feel like provider search and candidate selection, while the right side clearly becomes the selected work preview and personal record form.

Useful ideas:

- Two-column split flow
- Left column for search and candidate results
- Right column for selected-work preview and personal record form
- Strong selected candidate state
- Larger selected-work poster preview
- Status as direct buttons instead of a select
- More prominent full-width save CTA
- Clear separation between metadata confirmation and personal notes

## Keep

- Search/results left column and record form right column
- Candidate cards with poster, badges, title, contributor/year, and select state
- Clear selected candidate state using border/background emphasis
- Larger selected-work preview header
- Type/source/year/provider badges in the preview header
- Personal record section as the primary user-owned input area
- Status button group or segmented control
- Full-width primary save action
- Advanced fields kept in an accordion/disclosure

## Do Not Copy Directly

- Tailwind implementation
- SideNavBar
- TopAppBar
- Material Symbols dependency
- Inter / Work Sans font stack
- English labels such as `Status`, `Rating`, `Short Comment`, `Detailed Review`
- Mock search data or mock external images
- Markdown-supported claim unless the app supports it end-to-end
- Remembered selected candidate behavior that bypasses duplicate detection
- Any change to `catalogTitleId`, `importDraft`, duplicate detection, Dexie, syncQueue, or local-first save behavior

## Implementation Guidance

Rebuild selected ideas with the existing Work Archive UI system:

- Mantine
- `FlowPageTemplate`
- `PageHero`
- `QuickAddWorkForm`
- `SectionCard`
- `PageSection`
- `ArtworkPoster`
- `AppBadge`
- `AppButton`
- `FeedbackMessage`
- current design tokens from `docs/design/DESIGN.md`

Keep:

- Current `MainProductLayout`
- Current `WorkCreatePage` saved-work success flow
- Current `QuickAddWorkForm` search and candidate selection logic
- Current local-first save through `worksService.createWork`
- Current `catalogTitleId` / identity-only `importDraft` contract
- Current duplicate detection and duplicate confirmation flow
- Current manual/preview candidate fallback behavior
- Current advanced fields accordion

## Suggested Implementation Scope

Quick Add only:

1. Improve candidate rows into clearer selectable cards.
2. Make selected candidate state visually stronger.
3. Convert selected-work confirmation into a stronger preview header.
4. Make `ArtworkPoster` larger in the selected preview.
5. Consider changing status selection from `NativeSelect` to a button/segmented control.
6. Keep rating select for the first pass unless a tested rating component is introduced.
7. Make the primary save CTA visually stronger or full-width.
8. Preserve duplicate confirmation and local-first identity behavior exactly.

## Recommended Codex Scope

```text
Use the Stitch quick-add reference to improve WorkCreatePage/QuickAddWorkForm UI. Do not paste Tailwind HTML. Preserve Mantine, FlowPageTemplate, MainProductLayout, local-first save, Dexie, syncQueue, importDraft, catalogTitleId, duplicate detection, and current tests. Improve candidate cards, selected-work preview header, status input presentation, and save CTA clarity.
```

## Review Notes

This is one of the highest-value Stitch drafts because it aligns with existing functionality instead of proposing a new product structure. The key implementation risk is accidentally changing data behavior while improving presentation. Treat all identity, duplicate, and sync behavior as locked.
