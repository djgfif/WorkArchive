# Work Archive Frontend Audit and Final Design Spec

## Executive judgment

The project already has the correct foundation for a premium frontend: Vite React, Mantine 7, CSS variables, CSS Modules, local-first data, routing, auth/session wrapper, sync runtime, and reusable primitives. The next step is not a stack change. The next step is to consolidate the existing design language into a stronger cinematic product surface.

Recommended final direction:

> Mantine + CSS Modules + existing theme tokens, upgraded into a premium cinematic archive UI.

Avoid:

- Tailwind migration.
- CSS-in-JS migration.
- Full component rewrite.
- Copying Netflix branding.
- Replacing existing service/query/auth/sync logic.

## Current frontend structure observed

- Root package uses npm workspaces.
- Web app is `apps/web`.
- Web app uses Vite, React, Mantine, React Router, Dexie, and shared types.
- `main.tsx` applies Mantine provider, app theme, color scheme manager, CSS variable resolver, and global CSS.
- `App.tsx` wraps router under `AuthProvider` and `AutoSyncRuntime`.
- Routes are already product-like: Home, Works, Create, Detail, Edit, Profile, Auth, Account, redirects, Not Found.
- Theme already defines a premium dark direction called “Calm Premium Dark”.
- Global CSS already defines a deep navy gradient background and sticky product header.
- Shared primitives already exist and should be upgraded rather than replaced.
- Archive components already include poster fallback, shelves, hero, search, filters, rating, progress, empty state, skeletons.
- Home already has hero/search/stats/shelves/timeline.
- Works already has URL-driven search/filter/scope/view mode and progressive rendering.
- Detail already has poster hero, tabs, personal record, timeline, and metadata.
- Form already has stepper, preview poster, tags input, rating input, review focus, and mobile save affix.

## Main design problem

The current project has many good parts, but the visual language is not yet concentrated enough. Some pages already feel premium, while others still look like well-styled CRUD. The large-company-level jump comes from consistency and hierarchy:

1. Stronger first screen.
2. Stronger poster system.
3. Stronger command bar/filter density.
4. Better separation of personal records vs metadata.
5. Less repeated inline styling.
6. More reusable CSS Module surfaces.
7. Better use of real/fallback artwork.

## Final visual target

Use the included PNGs as the target:

- `workarchive_home_design.png`
- `workarchive_library_design.png`
- `workarchive_detail_design.png`
- `workarchive_premium_design_board.png`

The images are implementation mockups, not screenshots of the running app. They define composition, density, hierarchy, spacing, color, and mood.

## Page-level target

### Home

Home should be the cinematic personal hub:

- Big hero.
- Search visible immediately.
- Add-work CTA available.
- Poster stack visual on desktop.
- Metrics immediately below hero.
- Continue shelf.
- Recent shelf.
- Activity timeline.

### Works

Works should be the actual library:

- Compact hero command bar.
- Search always visible.
- Grid/list toggle visible.
- Active/trash scope visible.
- Status filters visible.
- Advanced filters collapsible.
- Poster grid dominant.
- List view dense and operational.

### Detail

Detail should be a personal dossier:

- Poster + title + badges + rating + progress in one hero.
- Personal summary panel on wide desktop.
- Tabs below: personal record, timeline, metadata.
- Personal notes and tags dominate.
- Metadata remains lower hierarchy.

### Form

Form should be a capture flow:

- Main stepper form.
- Sticky preview poster panel.
- Better token consistency.
- Mobile save affix preserved.

## Implementation priorities

### P0

- Fix token mismatches.
- Tighten theme/global CSS.
- Upgrade poster/fallback visual system.
- Upgrade Home hero and Works toolbar.
- Ensure responsive no-overflow.

### P1

- Move repeated inline styling to CSS Modules.
- Upgrade Detail hero and tabs.
- Upgrade form preview and mobile affix.
- Upgrade loading/empty/error visual consistency.

### P2

- Additional microinteractions.
- Shelf edge fades.
- Further dashboard/insight polish if those routes are restored or expanded.

## Technical recommendation

Keep Mantine. Use CSS Modules as the styling layer. This matches Mantine’s current direction and the project’s existing code structure. Do not add Tailwind or styled-components.

## Verification checklist

- `npm run typecheck --workspace @work-archive/web`
- `npm run lint --workspace @work-archive/web`
- `npm run test --workspace @work-archive/web`
- `npm run build --workspace @work-archive/web`

Manual viewport checks:

- 320px
- 375px
- 430px
- 768px
- 1024px
- 1440px
- 1920px

State checks:

- Empty archive.
- Populated archive.
- Loading.
- Error.
- Filtered empty.
- Trash empty.
- Guest.
- Authenticated.
- Missing thumbnail.
- Real thumbnail.
- Long title.
- Long review.
- Mobile save.
