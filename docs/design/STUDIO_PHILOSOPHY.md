# Studio

| Field                 | Value                                                           |
| --------------------- | --------------------------------------------------------------- |
| Status                | `active`                                                        |
| Role                  | `visual design guidance`                                        |
| Source of truth       | [`PRODUCT_CONSTITUTION.md`](../product/PRODUCT_CONSTITUTION.md) |
| Last verified against | `2026-08-26` product-principle audit                            |
| When to update        | visual hierarchy, semantic colour, motion, or trust cues change |

> A visual philosophy for the personal archive — the calm confidence of a
> well-made product.

> Supersedes _Vellum Index_ (warm archival dark + editorial gold), the
> earlier direction. The legacy manifesto survives in git history and in the
> `VELLUM_INDEX.png` mockup; this document describes the current system.

---

## The Movement

**Studio** is the aesthetic of the modern workspace — the quiet competence of a
tool that respects your time. Where _Vellum Index_ once dressed the archive as
an antique catalogue, Studio treats it as a contemporary product: neutral,
legible, unobtrusive. Nothing is ornamental for its own sake. Surfaces recede so
that the work — the covers, the records, the numbers — can come forward. The
interface should feel familiar on first use and invisible by the tenth, the way
the best software dissolves into habit.

## Space & Form

Space is structure. The layout breathes through even rhythm on a consistent
grid, divided by hairline borders rather than heavy rules. Forms are rectangular
and softly rounded — cards, fields, and columns at a calm 8–12px radius that
reads as machined, not decorated. Content is shelved along a single dominant
axis; secondary elements align beneath it in predictable columns. The eye travels
the way a cursor travels a familiar app — steadily, without hesitation.

## Colour & Material

The palette is neutral first. Slate-grey surfaces — near-black in dark,
near-white in light — carry the composition with no temperature or mood of their
own. Against this neutrality sits a single brand accent: a modern **indigo**,
spent sparingly to mark what is active, selected, or actionable — the one
saturated voice in an otherwise quiet room. Warmth returns in exactly one place:
the **amber** of a rating star, because a gold star is the universal language of
judgement, understood without explanation. Depth is built from surface elevation
and border; shadow is reserved for what genuinely floats — menus, modals, the
lifted card.

## Scale & Rhythm

Hierarchy comes from weight and size, never from a change of voice. One
sans-serif — **Pretendard** — speaks throughout, from the largest title to the
smallest label, so the page stays coherent and the leaps in scale read as
deliberate. Display sizes are confident but restrained. Numbers are set in
tabular figures so they stack like a register. The cadence is steady and
product-like — heading, content, divider, heading — a rhythm the user can
predict and therefore trust.

## Composition & Hierarchy

Importance is shown by placement, weight, and the indigo accent — not by noise.
Systematic markers — monospaced reference numbers, status badges, registration
ticks — keep the catalogue legible at a glance. Text earns its place: a title, a
label, a single line of intent. The interface explains itself through structure
and convention, leaning on patterns the user already knows from the software they
open every day.

## Trust And Deliberate Friction

Studio의 절제는 위험 상태를 무채색으로 숨기라는 뜻이 아니다. 일반 정보는
조용하게 유지하되 오류, 경고, 성공, 공개 상태는 semantic token과 명확한 copy로
구분한다. 데이터 삭제, 공개, sync conflict, 되돌릴 수 없는 결과에는 추가 확인과
영향 요약을 둔다. 이 마찰은 장식이 아니라 사용자 신뢰를 지키는 기능이다.

## The Standard

The finished artifact must feel effortless and trustworthy — the result of
restraint, of a thousand small decisions to _remove_ rather than add. It should
look manufactured to a high tolerance, not hand-distressed; assured, not loud.
Up close it rewards the eye with precise alignment and consistent spacing; from
across the room it holds as one calm, neutral whole. This is the quiet confidence
of good product design: familiar enough to use without thinking, refined enough
to trust with years of one's records.

---

## In practice

The philosophy resolves to tokens in
[`apps/web/src/app/mantine-theme.ts`](../../apps/web/src/app/mantine-theme.ts)
(`--app-*` / `--wa-*` CSS variables) and
[`apps/web/src/app/styles/global.css`](../../apps/web/src/app/styles/global.css).
Change values there — never inline.

- **Surfaces** — neutral slate. Dark shell `#0a0a0c`, card `#1c1c22`; light shell
  `#fbfbfd`, card `#ffffff`. Depth via `--app-surface-*` elevation + `--app-border-*`.
- **Brand accent** — indigo. `--app-accent-primary` `#6366f1` (dark) / `#4f46e5`
  (light). Used only for active states, selection, and primary CTAs.
- **Rating accent** — amber. `--app-accent-warm` `#fbbf24` (dark) / `#d97706`
  (light). Stars only; do not borrow it as a general accent.
- **Type** — Pretendard for body _and_ display (`--app-font-display`); JetBrains
  Mono for codes and numerals. No editorial serif.
- **Radius** — `md` 8px (controls), `lg` 12px (cards), `xl` 16px (modals).
- **Numerals** — tabular (`font-variant-numeric: tabular-nums`).
- **Contrast** — text tokens hold WCAG AA (muted ≈5:1 against the shell).
