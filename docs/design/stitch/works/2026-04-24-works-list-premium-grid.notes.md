# Works List Premium Grid Stitch Draft

| Field | Value |
| --- | --- |
| Status | `reference-only` |
| Role | `works list visual exploration` |
| Source of truth | Google Stitch output, root `DESIGN.md`, current `WorksListPage` implementation |
| Last reviewed | `2026-04-24` |
| When to update | this Stitch draft is re-generated, implemented, superseded, or rejected |

## Status

Reference only. Do not copy the generated Tailwind HTML directly into `apps/web`.

This draft explores a denser, poster-first Works list. It is more directly applicable than the home screen draft because the current Works page already has search, filters, sort, trash scope, and list/grid view modes.

## Source

Generated with Google Stitch.

Stored reference:

- [`2026-04-24-works-list-premium-grid.html`](./2026-04-24-works-list-premium-grid.html)

## Design Value

The draft improves the collection-browsing feeling of the works list. It makes the page feel more like a personal media vault by emphasizing cover/poster artwork and fast scanability.

Useful ideas:

- Poster-dense grid
- 4~5 column desktop browsing density
- Status badge overlay on poster cards
- Compact grid/list view switcher
- Type filter chips
- Search-first toolbar
- Typographic fallback for missing artwork
- List view parity for compact scanning

## Keep

- Dense poster grid
- Status badge overlay
- Grid/list view switcher
- Search + filter toolbar emphasis
- Type filter chips if they map cleanly to actual WorkArchive types
- Typographic fallback card for works without thumbnails
- Hover state that makes cards feel clickable
- Thin border-based separation

## Do Not Copy Directly

- Tailwind implementation
- Left sidebar shell
- Fixed topbar rewrite
- Material Symbols dependency
- Inter / Work Sans font stack
- English/generic IA
- Generic categories that do not match actual WorkArchive media types
- Smaller Tailwind radius scale
- Heavy blur/glass effects
- Any change to local-first save, Dexie, syncQueue, or backend sync behavior

## Implementation Guidance

Rebuild selected ideas with the existing Work Archive UI system:

- Mantine
- `WorkspacePageTemplate`
- `WorksToolbar`
- `WorksList`
- `WorkCard`
- `WorkListRow`
- `ArtworkPoster`
- `AppBadge`
- `AppButton`
- current design tokens from root `DESIGN.md`

Keep:

- Current `MainProductLayout`
- Current top navigation
- Current Korean product language
- Current local-first product model
- Current Works list URL query behavior
- Current trash scope behavior
- Current quick update behavior in list mode

## Suggested Implementation Scope

WorksListPage only:

1. Improve grid view density.
2. Consider columns around `base: 2`, `sm: 3`, `lg: 4`, `xl: 5`.
3. Move status badge into a poster overlay for grid cards.
4. Keep title and compact metadata below the poster.
5. Preserve list mode behavior and quick update actions.
6. Make view switcher more compact and accessible.
7. Consider type filters as chips while preserving current filter semantics.
8. Keep sort as a select unless chip replacement clearly improves usability.

## Recommended Codex Scope

```text
Use the Stitch works-list reference to improve WorksListPage grid density and scanability. Do not paste Tailwind HTML. Preserve Mantine, AppPrimitives, MainProductLayout, URL query behavior, local-first data flow, trash scope, and list quick updates. Implement poster-first grid cards, status badge overlay, compact view switcher, and tests.
```

## Review Notes

This draft has high implementation value. Unlike the home draft, the works-list draft maps directly to an existing surface that already supports grid/list modes. The best path is to extract grid density, poster emphasis, and compact filters while rejecting the sidebar and Tailwind shell.
