# Add Work Quick Add Flow Stitch Draft

| Field | Value |
| --- | --- |
| Status | `reference-only` |
| Role | `work creation and quick-add visual exploration` |
| Source of truth | Google Stitch output, `docs/design/DESIGN.md`, current `WorkCreatePage` and `QuickAddWorkForm` implementation |
| Last reviewed | `2026-04-24` |
| When to update | this Stitch draft is re-generated, implemented, superseded, or rejected |

## Status

Reference only. Do not copy the generated Tailwind HTML directly into `apps/web`.

This draft explores a stronger two-column Quick Add flow for Work Archive. It is highly applicable because the current product already has the same conceptual flow: search, choose candidate, confirm metadata, enter personal record, and save locally.

## Source

Generated with Google Stitch, then cleaned up as a Work Archive implementation reference.

Stored reference:

- [`2026-04-24-add-work-quick-add-flow.html`](./2026-04-24-add-work-quick-add-flow.html)

## Design Value

This is one of the highest-value Stitch references so far because it maps directly to the current Quick Add implementation.

Useful ideas:

- Two-column flow: search/results on the left, selected work and personal record on the right
- Card-like candidate rows with poster, badges, title, contributor, and selection state
- Strong selected-work preview header
- Larger poster for the selected candidate
- Status selection as direct buttons rather than a select-only field
- Clear personal-record section for status, rating, short review, and detailed review
- Strong full-width save action
- Manual entry fallback as a secondary action

## Keep

- Two-column search-and-record layout
- Search panel and candidate results panel separation
- Candidate cards with clear selected state
- Candidate poster/title/source/type/confidence hierarchy
- Selected work preview header with poster and metadata
- Personal record inputs grouped after metadata confirmation
- Status button group or segmented-style control
- Full-width or visually stronger save button
- Direct/manual input fallback as a secondary action
- Duplicate warning flow and existing-record links from the current implementation

## Do Not Copy Directly

- Tailwind implementation
- Left sidebar shell
- TopAppBar rewrite
- Material Symbols dependency
- Inter / Work Sans font stack
- English copy such as `Status`, `Rating`, `Short Comment`, `Detailed Review`
- Grayscale image hover effect that hides useful cover information
- Markdown support label unless markdown behavior is implemented
- Any change to local-first save, Dexie, syncQueue, `catalogTitleId`, `importDraft`, or duplicate detection
- Any change that turns Quick Add into server-first create

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
- `AppLinkButton`
- `FeedbackMessage`
- current design tokens from `docs/design/DESIGN.md`

Keep:

- Current `MainProductLayout`
- Current `/works/new` route
- Current Korean product language
- Current local-first `worksService.createWork` path
- Current `Dexie -> syncQueue` behavior
- Current `catalogTitleId` and identity-only `importDraft` rules
- Current duplicate detection and duplicate-confirm flow
- Current manual/preview fallback behavior
- Current advanced information accordion

## Suggested Implementation Scope

WorkCreatePage / QuickAddWorkForm only:

1. Keep the current two-column architecture, but make it visually stronger.
2. Improve candidate rows into clearer selectable cards.
3. Make the active candidate state more obvious with border/background emphasis.
4. Strengthen the selected candidate preview header.
5. Consider larger `ArtworkPoster` usage for the selected candidate.
6. Convert status selection from select-only to a segmented/button group if implementation remains simple and accessible.
7. Keep rating select initially, or introduce a star rating component only as a separate well-tested change.
8. Make the primary save action more prominent, ideally full-width in the record panel.
9. Keep cancel/list navigation as a lower-emphasis secondary action.
10. Preserve all current validation, duplicate, import identity, and local-first save behavior.

## Recommended Codex Scope

```text
Use the Stitch add-work reference to improve WorkCreatePage / QuickAddWorkForm UI. Do not paste Tailwind HTML. Preserve Mantine, AppPrimitives, MainProductLayout, Korean copy, local-first save, Dexie, syncQueue, catalogTitleId/importDraft rules, duplicate detection, and manual fallback behavior. Improve candidate card scanability, selected candidate preview, status input, and save CTA. Add or update web tests for search, candidate selection, duplicate confirmation, and local-first identity submission.
```

## Review Notes

This draft is visually strong and product-aligned. The most valuable extraction is not the shell; it is the candidate-to-record composition. The implementation should keep the current safe data flow and only improve hierarchy, density, and CTA clarity.
