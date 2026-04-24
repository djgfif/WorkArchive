# Home Premium Archive Stitch Draft

| Field | Value |
| --- | --- |
| Status | `reference-only` |
| Role | `home screen visual exploration` |
| Source of truth | Google Stitch output, root `DESIGN.md`, current `HomePage` implementation |
| Last reviewed | `2026-04-24` |
| When to update | this Stitch draft is re-generated, implemented, superseded, or rejected |

## Status

Reference only. Do not copy the generated Tailwind HTML directly into `apps/web`.

This draft explores a more premium archive-style home screen for Work Archive. It is useful for visual direction, but it does not override the product's current Mantine-based implementation, local-first architecture, or Korean-first copy direction.

## Source

Generated with Google Stitch.

Stored reference:

- [`2026-04-24-home-premium-archive.html`](./2026-04-24-home-premium-archive.html)

## Design Value

The draft strengthens the home screen as a visual archive hub. It makes recent records and in-progress records feel more important and more visually browsable than a plain list.

Useful ideas:

- Premium dark archive mood
- Poster-led visual hierarchy
- Recent records bento grid
- Large hero recent card
- Smaller supporting poster cards
- In-progress rows with progress bars
- Stronger sense of returning to an active archive

## Keep

- Recent Records bento layout
- Large lead recent-record card
- Small poster cards for secondary recent records
- In Progress section
- Progress bars for currently consumed works
- Poster hover emphasis
- Quiet border-based card separation
- Archive-blue active/accent treatment

## Do Not Copy Directly

- Tailwind implementation
- Left sidebar shell
- Top app bar rewrite
- Material Symbols dependency
- English IA/copy
- Inter / Work Sans font stack
- Material-style color token explosion
- Pure black sidebar treatment
- Smaller Tailwind radius scale
- Any change that implies server-first save or community/public catalog promotion as the default path

## Implementation Guidance

Rebuild selected ideas with the existing Work Archive UI system:

- Mantine
- `HomeHubPageTemplate`
- `PageHero`
- `SectionCard`
- `PageSection`
- `ArtworkPoster`
- `AppBadge`
- `AppButton`
- `AppLinkButton`
- current design tokens from root `DESIGN.md`

Keep:

- Current `MainProductLayout`
- Current top navigation
- Current Korean product language
- Current local-first product model
- Current archive-blue color system
- Current no-shadow / border-based depth

## Suggested Implementation Scope

HomePage only:

1. Convert recent works area into a bento layout.
2. Render `recentWorks[0]` as a larger lead card.
3. Render `recentWorks[1]` and `recentWorks[2]` as smaller poster cards.
4. Add an `이어보는 중` section for `in_progress` works.
5. Show progress bars when `progressCurrent` and `progressTotal` are available.
6. Keep the existing `PageHero`, search card, and primary CTA.
7. Do not introduce sidebar navigation in this pass.

## Recommended Codex Scope

```text
Use the Stitch home reference to improve HomePage, but do not paste Tailwind HTML. Preserve Mantine, AppPrimitives, current MainProductLayout, local-first product language, and current tokens. Add a bento recent-record section and an in-progress section with safe progress handling and tests.
```

## Review Notes

The draft is visually strong, but it leans toward a premium dashboard/library SaaS. Work Archive should remain a personal local-first archive. Treat the Stitch draft as layout inspiration, not as a new design system.
