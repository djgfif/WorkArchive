# Community benchmark design QA

- Source visual truth: `benchmark-letterboxd-reviews.png`, `benchmark-anilist-social.png`, and `community-baseline-1280.png` in the Codex visualization workspace.
- Implementation screenshots: `community-improved-pass1.png`, `community-improved-1024x768.png`, `community-improved-390x844-pass2.png`, and `community-improved-320x760.png` in the same workspace.
- Combined evidence: `community-benchmark-comparison-pass1.png` and `community-mobile-comparison-pass2.png`.
- Desktop viewport: 1280 x 720 CSS px. Captures were 1275 x 717, 1265 x 712, and normalized to 640 x 360 cells in the 1280 x 720 comparison board.
- Tablet viewport: 1024 x 768 CSS px. Capture was 1019 x 764.
- Mobile viewport: 390 x 844 CSS px. Captures were 385 x 833 and compared side by side without scaling in a 770 x 833 board. The 320 x 760 viewport was also checked separately.
- Device scale factor: browser default. Comparisons used equal CSS viewports and normalized raster dimensions where the benchmark browser chrome differed.
- State: authenticated account without a community handle; empty community feed and empty board.

## Full-view comparison evidence

The four-up comparison board shows the two benchmark patterns, the original Work Archive state, and the revised state together. Letterboxd makes the work, author, rating, and review body scannable as one unit; AniList separates activity, forum, and review regions; the original Work Archive state used large empty vertical regions with little direction. The revised state keeps the Studio identity while adding a three-path discovery strip, a visible privacy promise, compact empty-state actions, and a contextual guide rail.

The benchmark ads, persistent sign-up pressure, and high-density activity metrics were intentionally excluded because they obscure content, compete with personal-record use, and weaken the explicit-publication boundary.

## Focused region comparison evidence

`community-mobile-comparison-pass2.png` compares the first and second 390 x 844 passes. The first pass stacked all three discovery paths and pushed the feed below the first screen. The second pass uses a horizontally scrollable, snap-aligned path strip, bringing the feed heading and filters into the initial viewport while preserving every destination and a 44 px minimum action target.

## Required fidelity surfaces

- Fonts and typography: retained Pretendard for UI/display and the existing figure font for compact labels. Heading weight, body line-height, wrapping, and tab labels remain readable at 320 px. No benchmark brand typography was copied.
- Spacing and layout rhythm: removed the empty trending gap when there is no data, consolidated feed controls into one toolbar, and reduced board participation/empty states from two oversized panels to compact purposeful surfaces. Desktop, 1024 px, 390 px, and 320 px have no document-level horizontal overflow.
- Colors and visual tokens: all new surfaces use Studio background, border, text, indigo-state, and rating-only amber tokens. Indigo remains limited to navigation, active state, and primary action roles.
- Image quality and asset fidelity: no fake covers, illustrations, SVG substitutes, emoji, or placeholder art were added. Poster/cover imagery remains catalog-driven and appears only when real community data exists.
- Copy and content: entry points state what each area is for and why the user might use it. Privacy copy appears before participation, and empty states offer concrete next actions without claiming nonexistent activity.
- Icons and controls: existing product iconography is unchanged. New navigation uses text hierarchy instead of invented symbols. Tabs now have explicit accessible labels.
- Interaction and accessibility: board category switching was exercised and updates both selected state and category-specific guidance. Links and buttons retain at least 44 px targets; mobile bottom navigation remains unchanged; spoiler and authoring behavior were not modified.

## Comparison history

### Pass 1

- P2 — Mobile discovery paths consumed too much above-the-fold height at 390 x 844.
  - Evidence: `community-improved-390x844-pass1.png` showed all three paths stacked before the handle prompt; the feed was not visible.
  - Impact: a user who deliberately entered Community could not reach actual community content without a long introductory scroll.
  - Fix: changed the mobile path navigation to a single horizontal snap row with a visible next-card edge.

### Pass 2

- Post-fix evidence: `community-improved-390x844-pass2.png` and `community-mobile-comparison-pass2.png` show the feed heading and both filter groups in the first viewport.
- 320 x 760 verification: document scroll width equals viewport width (320 px); no persistent controls overlap or clip.
- 1024 x 768 verification: content begins below the fixed desktop header and the rail collapses to a single column as intended.
- Browser console: no warning or error entries from the Work Archive development origin. Remaining entries were development connection messages and logs retained from benchmark sites.

## Findings

No actionable P0, P1, or P2 findings remain. The horizontal discovery strip uses an intentionally visible scrollbar/next-card edge as an affordance; hiding it would reduce discoverability at narrow widths.

## Follow-up polish

- P3: when real community data is available, repeat the same visual pass with long Korean titles, five-digit reaction counts, spoiler reviews, and real cover crops.

final result: passed
