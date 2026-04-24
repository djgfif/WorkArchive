# Design Documentation

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `design documentation index` |
| Source of truth | [`../../DESIGN.md`](../../DESIGN.md), current `apps/web` implementation, Stitch reference drafts |
| Last verified against | `2026-04-24` working tree |
| When to update | design token source, Stitch reference storage rules, or UI implementation guidance changes |

This directory stores design-system documentation and generated design references for Work Archive.

## Primary Design Contract

- [`../../DESIGN.md`](../../DESIGN.md): root-level self-contained design-system contract for Stitch/design.md-compatible workflows.

The root `DESIGN.md` is the canonical product design contract. It describes tokens, visual identity, interaction principles, local-first product language, and implementation boundaries. Keep it self-contained and do not reference internal code variables from inside that file.

## Stitch-to-Product Translation

- [`STITCH_TO_PRODUCT_EVOLUTION_PLAN.md`](./STITCH_TO_PRODUCT_EVOLUTION_PLAN.md): canonical plan for extracting useful ideas from Stitch drafts and translating them into the real Work Archive UI.

Use this plan before implementing Stitch-inspired UI changes. Stitch drafts are visual references; actual implementation should preserve Mantine, shared primitives, current routing, local-first product language, and sync boundaries.

## Stitch Reference Archive

- [`stitch/`](./stitch/): Google Stitch-generated design drafts and review notes.

Current references:

- [`stitch/home/2026-04-24-home-premium-archive.html`](./stitch/home/2026-04-24-home-premium-archive.html)
- [`stitch/home/2026-04-24-home-premium-archive.notes.md`](./stitch/home/2026-04-24-home-premium-archive.notes.md)
- [`stitch/works/2026-04-24-works-list-premium-grid.html`](./stitch/works/2026-04-24-works-list-premium-grid.html)
- [`stitch/works/2026-04-24-works-list-premium-grid.notes.md`](./stitch/works/2026-04-24-works-list-premium-grid.notes.md)

Stitch outputs are reference material, not implementation source. Do not paste Tailwind HTML directly into `apps/web`. Rebuild selected ideas with Mantine, shared primitives, and the existing Work Archive design tokens.

## Usage Rules

1. Use `DESIGN.md` as the official design contract.
2. Use `STITCH_TO_PRODUCT_EVOLUTION_PLAN.md` to decide what to extract from Stitch drafts.
3. Store Stitch exports under `docs/design/stitch/{surface}/`.
4. Pair each exported HTML draft with a `.notes.md` file explaining what to keep, what to ignore, and how to translate it into the actual codebase.
5. Keep actual implementation in `apps/web` using Mantine and shared UI primitives.
6. Do not let Stitch reference material redefine routing, product behavior, local-first sync, or community/public-data boundaries.

## Recommended Structure

```text
docs/design/
  README.md
  STITCH_TO_PRODUCT_EVOLUTION_PLAN.md
  stitch/
    README.md
    home/
      2026-04-24-home-premium-archive.html
      2026-04-24-home-premium-archive.notes.md
    works/
      2026-04-24-works-list-premium-grid.html
      2026-04-24-works-list-premium-grid.notes.md
```
