# Stitch Reference Archive

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `generated design reference archive` |
| Source of truth | Google Stitch exports, [`../../../DESIGN.md`](../../../DESIGN.md), current Work Archive UI system |
| Last verified against | `2026-04-24` working tree |
| When to update | Stitch storage policy, naming convention, or translation rules change |

This directory stores Google Stitch-generated design drafts.

## Important Rule

Stitch drafts are **reference only**. They are not implementation source.

Do not copy generated Tailwind HTML directly into `apps/web`. Translate selected ideas into the app using:

- Mantine
- shared UI primitives
- `ArtworkPoster`
- `SectionCard`
- `PageHero`
- `AppBadge`
- `AppButton`
- existing local-first product language

## Translation Plan

Before implementation, read:

- [`../STITCH_TO_PRODUCT_EVOLUTION_PLAN.md`](../STITCH_TO_PRODUCT_EVOLUTION_PLAN.md)

This plan explains how to extract only the useful parts of Stitch drafts while preserving Work Archive's design system, local-first behavior, and product boundaries.

## Naming Convention

Use:

```text
{yyyy-mm-dd}-{surface}-{short-description}.html
{yyyy-mm-dd}-{surface}-{short-description}.notes.md
```

Examples:

```text
home/2026-04-24-home-premium-archive.html
home/2026-04-24-home-premium-archive.notes.md
works/2026-04-24-works-list-premium-grid.html
works/2026-04-24-works-list-premium-grid.notes.md
```

## Notes File Checklist

Each `.notes.md` file should include:

- Status
- Source
- Design value
- Keep
- Do not copy directly
- Implementation guidance
- Suggested implementation scope

## Current References

### Home

- [`home/2026-04-24-home-premium-archive.html`](./home/2026-04-24-home-premium-archive.html)
- [`home/2026-04-24-home-premium-archive.notes.md`](./home/2026-04-24-home-premium-archive.notes.md)

### Works List

- [`works/2026-04-24-works-list-premium-grid.html`](./works/2026-04-24-works-list-premium-grid.html)
- [`works/2026-04-24-works-list-premium-grid.notes.md`](./works/2026-04-24-works-list-premium-grid.notes.md)
