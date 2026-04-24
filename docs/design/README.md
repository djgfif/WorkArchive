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

## Stitch Reference Archive

- [`stitch/`](./stitch/): Google Stitch-generated design drafts and review notes.

Stitch outputs are reference material, not implementation source. Do not paste Tailwind HTML directly into `apps/web`. Rebuild selected ideas with Mantine, shared primitives, and the existing Work Archive design tokens.

## Usage Rules

1. Use `DESIGN.md` as the official design contract.
2. Store Stitch exports under `docs/design/stitch/{surface}/`.
3. Pair each exported HTML draft with a `.notes.md` file explaining what to keep, what to ignore, and how to translate it into the actual codebase.
4. Keep actual implementation in `apps/web` using Mantine and shared UI primitives.
5. Do not let Stitch reference material redefine routing, product behavior, local-first sync, or community/public-data boundaries.

## Recommended Structure

```text
docs/design/
  README.md
  stitch/
    README.md
    home/
      2026-04-24-home-premium-archive.html
      2026-04-24-home-premium-archive.notes.md
```
