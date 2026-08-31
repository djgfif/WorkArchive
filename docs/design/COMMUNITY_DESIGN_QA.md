# Community Design QA

## Visual target

- Source: generated work-centric editorial feed reference retained outside the repository.
- Target: work-centric editorial community feed within the existing Studio design system.
- Primary verification viewport: 1280 x 720 in the selected in-app Browser.
- Data state: authenticated local development account with no community handle, no catalog titles, and no published community content. Empty states must remain intentional and truthful; no fake content or placeholder art is introduced for comparison.

## Acceptance checklist

- [x] Desktop header remains fixed and the Community destination stays active.
- [x] Hero, compact direct-publication entry, trending work section, editorial feed, and privacy rail follow the selected visual hierarchy.
- [x] Indigo is limited to active state and primary actions; amber remains rating-only.
- [x] Empty catalog/feed/profile data has a graceful real-data state.
- [x] Public-feed requests complete without browser console errors.
- [x] Source and implementation screenshot reviewed in one combined comparison image.
- [x] Boards, details, public profile, and taste routes checked through browser states and component coverage.
- [x] Keyboard focus, long content, spoiler controls, and horizontal overflow checked through browser and component coverage.
- [x] Responsive rules checked for the requested desktop and mobile breakpoints; the selected in-app Browser supplied a fixed 1280 x 720 runtime viewport, so exact-size mobile rendering is covered by component/CSS checks rather than a second browser engine.

## Iteration log

1. Initial implementation keeps the reference's work-first hierarchy while using Studio tokens, the existing fixed top navigation, and privacy-first empty states.
2. The combined source/implementation review exposed an over-tall handle-required state and an ambiguous empty trending region. The handle prompt was reduced to a compact inline action and the trending region now explains when real work data will appear.
3. Final 1280 x 720 browser verification covered the feed, boards, taste, and missing-profile routes with no horizontal overflow or console messages. The feed API validation failure found during this pass was traced to type-only DTO imports, corrected, rebuilt, and rechecked with a successful empty feed response.
