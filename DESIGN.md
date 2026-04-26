---
name: "Work Archive"
version: "1.0.0"
summary: "A calm, content-first personal media archive design system built around dark surfaces, muted archive blues, poster imagery, precise borders, and low-noise interaction states."
tokens:
  color:
    brand:
      archive:
        "0": { $type: color, $value: "#eef5fb" }
        "1": { $type: color, $value: "#dde8f1" }
        "2": { $type: color, $value: "#bfd1e4" }
        "3": { $type: color, $value: "#9bb5d4" }
        "4": { $type: color, $value: "#799cc7" }
        "5": { $type: color, $value: "#5d88bb" }
        "6": { $type: color, $value: "#4b78ac" }
        "7": { $type: color, $value: "#3d6390" }
        "8": { $type: color, $value: "#324f73" }
        "9": { $type: color, $value: "#253b55" }
    light:
      background:
        shell: { $type: color, $value: "#f5f6f8" }
        shellMuted: { $type: color, $value: "#eceef2" }
      surface:
        base: { $type: color, $value: "#ffffff" }
        raised: { $type: color, $value: "#f7f8fa" }
        sunken: { $type: color, $value: "#eef1f5" }
      border:
        default: { $type: color, $value: "#d7dde5" }
        strong: { $type: color, $value: "#b9c4d1" }
      text:
        strong: { $type: color, $value: "#18212d" }
        secondary: { $type: color, $value: "#445263" }
        muted: { $type: color, $value: "#6b7888" }
      accent:
        default: { $type: color, $value: "#3d6390" }
        soft: { $type: color, $value: "rgba(61, 99, 144, 0.10)" }
      danger:
        soft: { $type: color, $value: "rgba(220, 38, 38, 0.12)" }
    dark:
      background:
        shell: { $type: color, $value: "#14171b" }
        shellMuted: { $type: color, $value: "#1a1f25" }
      surface:
        base: { $type: color, $value: "#1c2128" }
        raised: { $type: color, $value: "#232932" }
        sunken: { $type: color, $value: "#2b3440" }
      border:
        default: { $type: color, $value: "rgba(255, 255, 255, 0.08)" }
        strong: { $type: color, $value: "rgba(255, 255, 255, 0.18)" }
      text:
        strong: { $type: color, $value: "#f1f5f9" }
        secondary: { $type: color, $value: "#d1d8e2" }
        muted: { $type: color, $value: "#9ca8b8" }
      accent:
        default: { $type: color, $value: "#9bb5d4" }
        soft: { $type: color, $value: "rgba(155, 181, 212, 0.14)" }
      danger:
        soft: { $type: color, $value: "rgba(248, 113, 113, 0.18)" }
    intent:
      success: { $type: color, $value: "#0f766e" }
      warning: { $type: color, $value: "#ca8a04" }
      danger: { $type: color, $value: "#dc2626" }
      info: { $type: color, $value: "#3d6390" }
  typography:
    fontFamily:
      sans:
        $type: fontFamily
        $value: ["IBM Plex Sans KR", "Pretendard Variable", "Pretendard", "sans-serif"]
      mono:
        $type: fontFamily
        $value: ["JetBrains Mono", "Fira Code", "monospace"]
    fontWeight:
      regular: { $type: fontWeight, $value: 400 }
      medium: { $type: fontWeight, $value: 500 }
      semibold: { $type: fontWeight, $value: 600 }
      bold: { $type: fontWeight, $value: 700 }
    fontSize:
      xs: { $type: dimension, $value: "0.8rem" }
      sm: { $type: dimension, $value: "0.93rem" }
      md: { $type: dimension, $value: "1rem" }
      lg: { $type: dimension, $value: "1.08rem" }
      xl: { $type: dimension, $value: "1.24rem" }
    heading:
      h1:
        fontSize: { $type: dimension, $value: "clamp(1.9rem, 4vw, 2.45rem)" }
        lineHeight: { $type: number, $value: 1.08 }
        fontWeight: { $type: fontWeight, $value: 700 }
        letterSpacing: { $type: dimension, $value: "-0.03em" }
      h2:
        fontSize: { $type: dimension, $value: "clamp(1.34rem, 3vw, 1.72rem)" }
        lineHeight: { $type: number, $value: 1.14 }
        fontWeight: { $type: fontWeight, $value: 700 }
        letterSpacing: { $type: dimension, $value: "-0.03em" }
      h3:
        fontSize: { $type: dimension, $value: "1.08rem" }
        lineHeight: { $type: number, $value: 1.24 }
        fontWeight: { $type: fontWeight, $value: 700 }
        letterSpacing: { $type: dimension, $value: "-0.03em" }
      h4:
        fontSize: { $type: dimension, $value: "1.02rem" }
        lineHeight: { $type: number, $value: 1.28 }
        fontWeight: { $type: fontWeight, $value: 700 }
        letterSpacing: { $type: dimension, $value: "-0.03em" }
    lineHeight:
      xs: { $type: number, $value: 1.35 }
      sm: { $type: number, $value: 1.45 }
      md: { $type: number, $value: 1.55 }
      lg: { $type: number, $value: 1.65 }
      xl: { $type: number, $value: 1.75 }
    letterSpacing:
      tight: { $type: dimension, $value: "-0.03em" }
      action: { $type: dimension, $value: "-0.01em" }
      eyebrow: { $type: dimension, $value: "0.12em" }
      badge: { $type: dimension, $value: "0.02em" }
  spacing:
    xs: { $type: dimension, $value: "0.5rem" }
    sm: { $type: dimension, $value: "0.75rem" }
    md: { $type: dimension, $value: "1rem" }
    lg: { $type: dimension, $value: "1.25rem" }
    xl: { $type: dimension, $value: "1.5rem" }
    shellPadding: { $type: dimension, $value: "clamp(1rem, 2vw, 1.5rem)" }
    mobileShellPadding: { $type: dimension, $value: "1rem" }
  size:
    content:
      narrow: { $type: dimension, $value: "47.5rem" }
      default: { $type: dimension, $value: "77.5rem" }
      shell: { $type: dimension, $value: "85rem" }
    poster:
      row: { $type: dimension, $value: "5.5rem" }
      card: { $type: dimension, $value: "7rem" }
      form: { $type: dimension, $value: "8.75rem" }
      detail: { $type: dimension, $value: "clamp(8.5rem, 18vw, 11rem)" }
  radius:
    xs: { $type: dimension, $value: "0.625rem" }
    sm: { $type: dimension, $value: "0.8rem" }
    md: { $type: dimension, $value: "0.95rem" }
    lg: { $type: dimension, $value: "1.15rem" }
    xl: { $type: dimension, $value: "1.45rem" }
    surface: { $type: dimension, $value: "1.15rem" }
    surfaceSmall: { $type: dimension, $value: "0.95rem" }
  border:
    width:
      hairline: { $type: dimension, $value: "1px" }
      activeNavigation: { $type: dimension, $value: "2px" }
    style:
      default: { $type: string, $value: "solid" }
  shadow:
    xs: { $type: shadow, $value: { color: "rgba(0, 0, 0, 0)", offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px" } }
    sm: { $type: shadow, $value: { color: "rgba(0, 0, 0, 0)", offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px" } }
    md: { $type: shadow, $value: { color: "rgba(0, 0, 0, 0)", offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px" } }
    lg: { $type: shadow, $value: { color: "rgba(0, 0, 0, 0)", offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px" } }
  elevation:
    flat: { $type: number, $value: 0 }
    card: { $type: number, $value: 1 }
    hero: { $type: number, $value: 2 }
    overlay: { $type: number, $value: 3 }
  motion:
    duration:
      fast: { $type: duration, $value: "160ms" }
      reduced: { $type: duration, $value: "0.01ms" }
    easing:
      standard: { $type: cubicBezier, $value: [0.25, 0.1, 0.25, 1] }
    transition:
      fast:
        $type: transition
        $value:
          duration: "160ms"
          delay: "0ms"
          timingFunction: [0.25, 0.1, 0.25, 1]
  component:
    button:
      radius: { $type: dimension, $value: "0.8rem" }
      fontWeight: { $type: fontWeight, $value: 600 }
      letterSpacing: { $type: dimension, $value: "-0.01em" }
      paddingInline: { $type: dimension, $value: "0.9rem" }
    badge:
      radius: { $type: dimension, $value: "0.8rem" }
      fontSize: { $type: dimension, $value: "0.72rem" }
      fontWeight: { $type: fontWeight, $value: 600 }
      letterSpacing: { $type: dimension, $value: "0.02em" }
      paddingInline: { $type: dimension, $value: "0.55rem" }
      textTransform: { $type: string, $value: "uppercase" }
    input:
      radius: { $type: dimension, $value: "0.95rem" }
      labelFontWeight: { $type: fontWeight, $value: 600 }
      labelMarginBottom: { $type: dimension, $value: "0.4rem" }
    artworkPoster:
      aspectRatio: { $type: string, $value: "3 / 4" }
      objectFit: { $type: string, $value: "cover" }
---

# Work Archive Design System

## Design Intent

Work Archive is a quiet personal archive for media records. It should not feel like an admin dashboard, a social feed, or a marketing landing page. The system prioritizes fast capture, long-term readability, and confidence that the user's collection is organized and preserved.

The visual identity is calm, compact, and editorial. It uses dark gray and deep blue-gray surfaces, restrained archive-blue accents, poster imagery, and clear information hierarchy. Decorative effects are intentionally minimized. Depth comes from surface contrast and thin borders rather than large shadows, neon glows, glassmorphism, or saturated gradients.

The product should communicate: **your records are safe, searchable, and easy to continue.**

## Visual Personality

- Calm, structured, and archival.
- Content-first rather than brand-first.
- Premium through restraint: clean spacing, quiet borders, and readable typography.
- Dark mode as the primary impression, with light mode supported through equivalent surface hierarchy.
- Poster and cover art provide the visual energy; the interface itself stays neutral.

Avoid heavy shadows, neon cyberpunk colors, large decorative gradients, overly playful iconography, dense enterprise-dashboard styling, and social-feed visual noise.

## Color System

The brand palette is an archive-blue scale. It should feel closer to blue-gray library shelving, paper labels, and catalog tabs than to bright SaaS blue.

Use the archive palette for primary actions, active navigation indicators, informational badges, subtle focus and selection states, and compact identity marks.

Use surfaces for most layout work. The shell background frames the full app. Base surface is used for primary cards and forms. Raised surface is used for nested panels, filter bars, and secondary cards. Sunken surface is used for quiet separation and local grouping.

In dark mode, keep the interface off-black. The main shell is near charcoal, while cards are slightly lighter. This creates separation without relying on shadows.

## Typography

The primary typography is Korean-first, readable, and UI-oriented. It must support long Korean review text, compact metadata, and structured page headings.

Headings are bold with tight letter spacing. Body copy should have generous line height. Eyebrows, badges, and section labels use uppercase-style spacing and small sizes. Reserve bold for headings, labels, and important values.

## Layout Principles

The layout system is shell-based. A full-page shell provides consistent padding and background. Content is centered in bounded containers. Major product pages use a wide workspace width. Detail and account pages are slightly narrower to preserve readability. Auth pages are narrow and focused.

Recommended page archetypes:

- Home hub: wide, exploratory, search-first, recent-record driven.
- Workspace: dense but calm, optimized for filtering, sorting, and scanning.
- Detail page: personal record first, metadata second.
- Flow page: step-based capture, large enough for side-by-side candidate and form panels.
- Account page: management-oriented, clear status sections and safe actions.
- Minimal page: centered message with a single clear next action.

## Surfaces and Elevation

Elevation is intentionally flat. The system uses surface color changes, thin borders, section dividers, clear spacing, and poster containment. Cards should not float. They should feel placed into a well-structured archive surface. Hero cards may use a stronger border, not a larger shadow.

## Components

Buttons use rounded rectangular shapes and semibold text. Primary actions use archive blue. Secondary actions use neutral/default treatments. Quiet actions are subtle and should not compete with primary flows.

Badges are compact, uppercase-feeling, and metadata-oriented. Use them for work type, status, sync state, provider identity, confidence, and warnings.

Cards are the primary building block. They should have rounded corners, thin borders, no shadow, controlled padding, and internal vertical rhythm. Nested cards should use subtle surfaces to avoid visual noise.

Forms should feel like record capture, not administration. Inputs sit on slightly raised surfaces with clear labels. Advanced metadata should often be hidden behind disclosure/accordion sections so the primary capture path remains fast.

Poster artwork is a key visual anchor. It uses a 3:4 ratio and rounded bordered containment. If artwork is missing or fails to load, show a typographic placeholder using the title initial and media type label.

## Layout Rules

- Creation screens use form-first layouts.
- Search selection uses a modal master-detail picker.
- Library browsing uses a poster-first grid.
- Detail pages use section-based layouts.
- Primary selection flows must not use expandable cards.
- Use accordion only for secondary metadata.
- Cards should not contain more than 3 metadata chips.

## Preferred Patterns

- `PosterTile`
- `SearchPickerModal`
- `CandidateListRow`
- `CandidatePreviewPanel`
- `RecordDetailSection`
- `CompactToolbar`
- `EmptyState`

## Interaction and Motion

Motion is minimal. Use short transitions for border color changes, background color changes, text color changes, and active navigation changes. Avoid complex motion, large movement, and ornamental animation. Respect reduced-motion preferences aggressively.

Focus states must be visible and should use the archive accent. Focus rings should be clear but not visually loud.

## Product-Specific Design Rules

### Local-first clarity

When a user searches with external providers, the UI must make it clear that search results can come from a server-assisted provider while saving remains local-first. The user's record should feel like it belongs to their archive first.

### Personal record before catalog metadata

On detail surfaces, show the user's status, rating, short review, review, progress, and favorite state before deeper catalog metadata.

### Sync clarity

Sync UI should separate pending changes, failed changes, and conflicts. Each item should expose the entity type, operation, retry count, last error when available, and safe actions such as viewing the record or retrying sync. Do not offer destructive conflict resolution unless the user can understand the consequences.

### Provider trust

Provider readiness should be visible in settings. The user should understand which providers work immediately, which need a user key, and which require server configuration.

### Community separation

Public/community/catalog promotion should not be visually implied as the default save path. Community features are additive; the personal archive remains the primary plane.

## Accessibility

Maintain strong contrast for text and controls in dark mode. Keep keyboard focus visible with a clear accent outline. Avoid relying on color alone; pair badges and messages with text. Keep line heights generous for long review text. Preserve readable layouts at 320px minimum width. Use reduced motion settings to suppress animation.

## Implementation Notes

When expanding the UI, preserve borders and surface hierarchy over shadows, archive blue as an accent rather than a decorative wash, poster imagery as the main source of visual richness, small uppercase-style labels for metadata, content-first page layouts, and local-first product language.

When redesigning or adding major screens, start with the information hierarchy first, then choose surfaces and components. Do not start from visual effects.
