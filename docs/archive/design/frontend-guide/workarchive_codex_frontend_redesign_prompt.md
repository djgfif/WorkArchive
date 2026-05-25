# Codex Prompt — Work Archive Premium Cinematic Frontend Redesign

You are working in `djgfif/WorkArchive`. Redesign the existing web frontend to match the attached visual target images:

- `workarchive_premium_design_board.png`
- `workarchive_home_design.png`
- `workarchive_library_design.png`
- `workarchive_detail_design.png`

The goal is **not** to copy Netflix branding. The goal is a **premium cinematic content-library UX**: content-first, dark, immersive, highly polished, with the reliability and density of a serious product dashboard. Think: streaming-service visual hierarchy + Linear/Vercel-level UI discipline + Work Archive’s personal, local-first archive identity.

## 0. Hard constraints

1. Do **not** rewrite business logic, data services, routing contracts, auth/sync behavior, or IndexedDB/server API calls unless a UI change strictly requires a tiny adapter.
2. Do **not** add Tailwind, styled-components, or Emotion.
3. Keep Mantine as the base UI system.
4. Use **CSS Modules + existing Mantine theme/CSS variables** as the primary styling approach.
5. Preserve the current routes and query behavior:
   - `/`
   - `/works`
   - `/works/new`
   - `/works/:id`
   - `/works/:id/edit`
   - `/profile`
   - `/auth/*`
   - `/account/*`
6. Preserve existing component responsibilities:
   - `HomePage` remains the personal archive hub.
   - `WorksListPage` remains the library/search/filter page.
   - `WorkDetailPage`/`WorkDetailPanel` remain the personal record dossier.
   - `WorkForm` remains create/edit/review-focus flow.
7. Keep accessibility: visible focus, keyboard navigation, aria labels, no click-only hidden controls.
8. Keep all loading, empty, error, guest, authenticated, active/trash, grid/list, and mobile states meaningful.
9. Do not remove tests. Update tests only when markup changes require it.
10. Final commands must pass:
   ```bash
   npm run typecheck --workspace @work-archive/web
   npm run lint --workspace @work-archive/web
   npm run test --workspace @work-archive/web
   npm run build --workspace @work-archive/web
   ```

## 1. Current frontend facts to respect

The web app is a Vite React app inside a npm workspace. It already uses Mantine 7, React 19, React Router 7, Dexie, and shared types.

Current app entry and theme:

- `apps/web/src/main.tsx` wraps the app with `MantineProvider`, `appColorSchemeManager`, `appCssVariablesResolver`, `defaultColorScheme="dark"`, and imports Mantine core CSS plus `global.css`.
- `apps/web/src/app/mantine-theme.ts` already defines a “Calm Premium Dark” theme with `archive` blue, `ember` amber, CSS variables for background/surface/text/border/shadow/motion, and Mantine component defaults.
- `apps/web/src/app/styles/global.css` already defines a deep navy radial-gradient page background, sticky product header classes, scrollbar styling, focus styling, utility classes, and page-enter animation.

Do not throw this foundation away. Upgrade it.

## 2. Visual design target

### Product identity

Use this language:

> Work Archive is a private cinematic archive for everything I read and watch.

The UI should feel like a premium media library, not a generic CRUD admin panel.

### Target qualities

- **Dark, cinematic, content-first.** Deep navy/black background, subtle blue and amber light sources, low-noise gradients.
- **Poster-led hierarchy.** Covers and fallback covers should be visually strong enough to carry the page even when real thumbnails are missing.
- **Big first impression.** Home and Works hero areas need the most polish.
- **Serious control density.** Filters, view switch, status chips, and quick actions must feel compact and exact, not scattered.
- **Personal record first.** Detail page should prioritize user’s rating, status, progress, review, tags, and timeline over generic metadata.
- **No loud gimmicks.** Use restraint: subtle motion, no over-animated UI, no heavy rainbow gradients.

### Color tokens

Keep existing variables where possible, but tighten/extend these concepts:

```css
--wa-bg-shell: #05070d;
--wa-bg-base: #080c16;
--wa-bg-elevated: #0d1424;
--wa-surface-subtle: #111a2e;
--wa-surface-card: #16213a;
--wa-surface-hero: #10192d;
--wa-surface-overlay: #111827;

--wa-border-subtle: rgba(148, 163, 184, 0.08);
--wa-border-default: rgba(148, 163, 184, 0.16);
--wa-border-strong: rgba(148, 163, 184, 0.28);

--wa-text-primary: #e8f0fe;
--wa-text-secondary: #94a3b8;
--wa-text-muted: #52647f;

--wa-accent-primary: #60a5fa;
--wa-accent-strong: #2563eb;
--wa-accent-warm: #fbbf24;
--wa-accent-teal: #2dd4bf;
--wa-accent-rose: #fb7185;
```

Motion:

```css
--wa-motion-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1);
--wa-motion-normal: 240ms cubic-bezier(0.16, 1, 0.3, 1);
--wa-motion-slow: 380ms cubic-bezier(0.16, 1, 0.3, 1);
```

Typography:

- Keep Korean readability first.
- Display: `clamp(3rem, 7vw, 6rem)` on cinematic hero.
- Section heading: `clamp(1.6rem, 3vw, 2.4rem)`.
- Body: 15–17px equivalent.
- Meta/eyebrow: 12–13px, uppercase where appropriate, high letter spacing.

## 3. Implementation plan by file

### 3.1 Theme and global shell

Files:

- `apps/web/src/app/mantine-theme.ts`
- `apps/web/src/app/styles/global.css`

Tasks:

1. Keep the existing theme structure.
2. Refine dark tokens toward the visual target.
3. Keep light mode functional, but optimize dark mode first.
4. Add missing aliases currently referenced by components, especially:
   - `--app-accent-secondary`
   - `--app-surface-default`
5. Make page background more cinematic:
   - deep navy base;
   - blue glow from upper-left;
   - faint amber glow from upper-right;
   - low-contrast bottom depth glow;
   - fixed background.
6. Keep `layout-shell`, `product-header`, `.header-left`, `.header-center`, `.header-right`, focus ring, scrollbar, reduced-motion rules.
7. Move one-off global component styling into CSS Modules when possible. Global CSS should only contain document-level and shell-level styling.

Acceptance:

- No missing CSS variable names in rendered screens.
- Dark mode looks intentional without needing real cover images.
- Light mode remains usable.

### 3.2 Main product layout/header

File:

- `apps/web/src/app/layouts/MainProductLayout.tsx`

Tasks:

1. Keep current route layout and auth/session behavior.
2. Refine header to match the image:
   - glassy rounded pill container;
   - brand block left;
   - centered nav;
   - right CTA + avatar;
   - compact height around 60–64px;
   - backdrop blur.
3. Do not add more top-level nav items. Current `홈`, `작품` is correct.
4. Keep mobile Drawer behavior and authenticated/guest profile menu.
5. Remove avoidable inline hover styling and move it to CSS Modules or global header classes.

Acceptance:

- Header is visually premium but not taller than needed.
- Desktop nav remains centered.
- Mobile still has burger + drawer.

### 3.3 Shared primitives

Files:

- `apps/web/src/shared/components/AppPrimitives.tsx`
- new optional `apps/web/src/shared/components/AppPrimitives.module.css`

Tasks:

1. Keep exported component names stable unless absolutely necessary.
2. Upgrade the visual quality of:
   - `SectionCard`
   - `SurfaceLinkCard`
   - `StatCard`
   - `MetricPill`
   - `FeedbackMessage`
   - `StateMessage`
   - `LoadingState`
   - `PageHeader`
3. Add reusable classes for:
   - cinematic card;
   - command-bar surface;
   - metric tile;
   - glass overlay;
   - dense filter chip;
   - media shelf section.
4. Reduce duplicated inline styles that are repeated in page files.
5. Preserve props and behavior.

Acceptance:

- Home/Works/Detail can share the same surface language.
- UI no longer feels like separate pages styled independently.

### 3.4 Archive visual components

Files:

- `apps/web/src/features/works/components/ArchiveComponents.tsx`
- `apps/web/src/features/works/components/ArchiveComponents.module.css`

Tasks:

1. Make `WorkPoster` the central design object.
2. Improve fallback poster:
   - preserve deterministic `coverSeed` tone;
   - add stronger poster spine;
   - add soft geometric light blobs;
   - add bottom gradient overlay;
   - keep title initial mark large and legible.
3. Improve real-thumbnail behavior:
   - maintain skeleton while loading;
   - real images object-fit cover;
   - hover zoom only on interactive cards;
   - fallback on image error.
4. Improve `WorkPosterCard`:
   - stronger hover elevation;
   - status overlay integrated at the bottom of the poster;
   - title and meta below poster, not inside a heavy card unless needed;
   - favorite badge top-right.
5. Improve `WorkShelf`:
   - horizontal cinematic rail;
   - snap scrolling;
   - fade/edge affordance if feasible without layout bugs.
6. Improve `ArchiveHero`:
   - variants `landing`, `compact`, `default` should map to different sizes but same design language;
   - landing hero should support poster stack/right-side visual if children/actions allow it.
7. Keep `ArchiveSearchBar`, `FilterPillGroup`, `SegmentedChoiceGroup`, `StarRatingInput`, `QuickProgressControl`, `ArchiveEmptyState`, `ArchiveSkeleton` behavior stable.

Acceptance:

- Empty/fallback covers look premium enough even without API thumbnails.
- Poster card grid looks like a media library, not a generic card grid.

### 3.5 Home page

File:

- `apps/web/src/features/home/pages/HomePage.tsx`

Tasks:

1. Match `workarchive_home_design.png`.
2. Hero:
   - large title “내 아카이브”;
   - subtitle explaining personal archive;
   - search bar and search CTA;
   - `+ 작품 추가` remains available;
   - right-side poster stack/visual composition using real `recentWorks` if available, fallback starter covers otherwise.
3. Below hero:
   - metric tiles for total/in-progress/completed/average rating;
   - continue shelf;
   - recent shelf;
   - activity timeline panel.
4. Timeline should remain lightweight and clickable.
5. Keep error/loading/empty logic and actions.

Acceptance:

- First screen at 1440/1920 looks like a polished media hub.
- At 375px, hero/search/CTA stack without horizontal overflow.
- Empty first-use state still guides the user to add the first work.

### 3.6 Works library page

Files:

- `apps/web/src/features/works/pages/WorksListPage.tsx`
- `apps/web/src/features/works/components/WorksToolbar.tsx`
- `apps/web/src/features/works/components/WorksList.tsx`
- `apps/web/src/features/works/components/WorkListRow.tsx`
- `apps/web/src/features/works/components/WorksTrashList.tsx`

Tasks:

1. Match `workarchive_library_design.png`.
2. Keep URL query contract exactly as current.
3. Toolbar:
   - compact hero command bar;
   - search always visible;
   - grid/list toggle;
   - filter button with active count;
   - active/trash scope chips;
   - status quick filters below or in compact rail;
   - advanced filters remain collapsible.
4. Grid view:
   - 2 columns mobile;
   - 3 columns small tablet;
   - 4–6 columns desktop;
   - poster cards remain visually dominant.
5. List view:
   - dense management row;
   - quick-edit collapse remains;
   - progress/rating/favorite/delete flows unchanged.
6. Keep progressive rendering/load-more behavior.

Acceptance:

- Works page feels like the main library of the product.
- Filter-heavy state remains understandable.
- Active/trash and grid/list states are obvious.

### 3.7 Work detail page

Files:

- `apps/web/src/features/works/pages/WorkDetailPage.tsx`
- `apps/web/src/features/works/components/WorkDetailPanel.tsx`

Tasks:

1. Match `workarchive_detail_design.png`.
2. Hero should feel like a personal dossier:
   - poster left;
   - type/status/favorite/tier badges;
   - title/author/recent update;
   - large rating block;
   - progress block;
   - primary actions;
   - compact personal-summary panel on the right when space allows.
3. Tabs:
   - `내 기록`, `타임라인`, `작품 정보` remain.
   - Personal record tab should visually dominate.
   - Metadata stays lower hierarchy.
4. Timeline:
   - keep collapse for long timelines;
   - latest-flow card remains first.
5. Related/release sections must remain usable but not overpower the personal record.

Acceptance:

- Detail page no longer feels like a database detail page.
- The user’s review/rating/progress are immediately visible.

### 3.8 Create/edit form

Files:

- `apps/web/src/features/works/pages/WorkCreatePage.tsx`
- `apps/web/src/features/works/pages/WorkEditPage.tsx`
- `apps/web/src/features/works/components/WorkForm.tsx`
- `apps/web/src/features/works/components/AddWorkFlow.tsx`
- `apps/web/src/features/works/components/AddWorkDialog.tsx`
- `apps/web/src/features/works/components/AddWorkSearchPanel.tsx`

Tasks:

1. Keep stepper/direct-input/search-candidate behavior.
2. Make form feel like a premium “capture flow”:
   - main form card;
   - sticky poster preview panel;
   - mobile bottom save affix;
   - high-quality star rating input.
3. Fix any remaining token mismatch, especially `--app-surface-default` and `--app-accent-secondary` references.
4. Keep title validation and focus management.
5. Keep review-focus mode behavior.

Acceptance:

- Create/edit do not look visually older than Home/Works/Detail.
- Mobile save action remains easy to access.

## 4. Responsive rules

Design for these breakpoints:

- 320px
- 375px
- 430px
- 768px
- 1024px
- 1440px
- 1920px

Rules:

1. No horizontal overflow at any breakpoint.
2. Header collapses to burger + brand + essential account affordance on mobile.
3. Home hero stacks search and actions on mobile.
4. Poster grid remains 2 columns on small mobile if readable; otherwise 1 column only if content is too cramped.
5. Detail hero stacks poster above content or poster/content vertically on narrow mobile.
6. Sticky/affix elements must account for safe-area inset.

## 5. Accessibility and quality bar

1. All interactive posters must have descriptive labels.
2. Focus rings must be visible on dark surfaces.
3. Keyboard shortcuts already present in WorksToolbar must remain:
   - `/` focuses search.
   - `g` toggles grid/list.
   - `f` toggles filters.
4. Respect `prefers-reduced-motion`.
5. Do not rely on color alone for status; keep text labels.
6. Loading skeletons should preserve approximate layout.
7. Empty states should always have next actions.
8. Error states should always include recovery actions when possible.

## 6. Do-not-break checklist

Before finishing, manually verify or test:

- Home: guest empty, guest populated, authenticated populated, loading, error.
- Works: active grid, active list, trash, empty, filtered-empty, loading, error, >60 grid items load-more.
- Detail: missing thumbnail fallback, real thumbnail, no rating, rating, progress-only type, long review, long timeline, related/release sections.
- Create/edit: title-only save path, search candidate apply, tags input, review focus mode, mobile bottom save.
- Account/auth pages still render with the new global theme.

## 7. Final output expected from this task

1. Code changes implementing the visual target.
2. No unnecessary dependency additions.
3. All commands pass:
   ```bash
   npm run typecheck --workspace @work-archive/web
   npm run lint --workspace @work-archive/web
   npm run test --workspace @work-archive/web
   npm run build --workspace @work-archive/web
   ```
4. Summarize changed files and describe how each visual target image was mapped to code.
