import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

// DESIGN.md 기준 아카이브 블루 팔레트 (blue-gray library tone)
const archiveColors: MantineColorsTuple = [
  '#eef5fb', // 0 — lightest
  '#dde8f1', // 1
  '#bfd1e4', // 2
  '#9bb5d4', // 3
  '#799cc7', // 4
  '#5d88bb', // 5
  '#4b78ac', // 6 — primary action (light)
  '#3d6390', // 7
  '#324f73', // 8
  '#253b55', // 9 — darkest
];

const emberColors: MantineColorsTuple = [
  '#fff6df',
  '#ffe8b3',
  '#ffd278',
  '#efb546',
  '#c98d24',
  '#9f6918',
  '#7c4f17',
  '#5f3d18',
  '#442d16',
  '#2d2012',
];

const appFontFamily =
  '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif';

export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

export const appCssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    // ── Motion ──────────────────────────────────────────────────────
    '--wa-motion-fast': '140ms ease',
    '--wa-motion-normal': '190ms ease',
    // ── Typography scale ────────────────────────────────────────────
    '--wa-type-display': 'clamp(2.4rem, 7vw, 5.2rem)',
    '--wa-type-h1': 'clamp(1.9rem, 4.5vw, 3.6rem)',
    '--wa-type-h2': 'clamp(1.35rem, 2.8vw, 2rem)',
    '--wa-type-h3': '1.08rem',
    '--wa-type-body': '1rem',
    '--wa-type-caption': '0.84rem',
    '--wa-type-meta': '0.76rem',
    // ── Aliases ─────────────────────────────────────────────────────
    '--app-type-display': 'var(--wa-type-display)',
    '--app-type-h1': 'var(--wa-type-h1)',
    '--app-type-h2': 'var(--wa-type-h2)',
    '--app-type-h3': 'var(--wa-type-h3)',
    '--app-type-body': 'var(--wa-type-body)',
    '--app-type-caption': 'var(--wa-type-caption)',
    '--app-type-meta': 'var(--wa-type-meta)',
    // ── Spacing ─────────────────────────────────────────────────────
    '--app-space-page': 'clamp(1.25rem, 3vw, 2.5rem)',
    '--app-space-section': 'clamp(2rem, 5vw, 4rem)',
    '--app-space-card': 'clamp(1rem, 2.4vw, 1.5rem)',
    '--app-space-control': '0.75rem',
  },
  light: {
    // ── Surfaces ────────────────────────────────────────────────────
    '--wa-bg-base': '#f5f6f8',
    '--wa-bg-elevated': '#eceef2',
    '--wa-surface-subtle': '#eef1f5',
    '--wa-surface-card': '#ffffff',
    '--wa-surface-hero': '#f7f8fa',
    // ── Borders ─────────────────────────────────────────────────────
    '--wa-border-subtle': '#d7dde5',
    '--wa-border-strong': '#b9c4d1',
    // ── Text ────────────────────────────────────────────────────────
    '--wa-text-primary': '#18212d',
    '--wa-text-secondary': '#445263',
    '--wa-text-muted': '#6b7888',
    // ── Accent ──────────────────────────────────────────────────────
    '--wa-accent-primary': '#3d6390',
    '--wa-accent-warm': '#c98d24',
    // ── Shadows ─────────────────────────────────────────────────────
    '--wa-shadow-card': '0 2px 8px rgba(0, 0, 0, 0.07)',
    '--wa-shadow-poster': '0 6px 20px rgba(0, 0, 0, 0.10)',
    '--wa-shadow-hero': '0 12px 40px rgba(0, 0, 0, 0.12)',
    // ── Mantine overrides ───────────────────────────────────────────
    '--mantine-color-body': '#f5f6f8',
    '--mantine-color-text': '#18212d',
    '--mantine-color-dimmed': '#6b7888',
    '--mantine-color-default': '#ffffff',
    '--mantine-color-default-hover': '#eceef2',
    '--mantine-color-default-border': '#d7dde5',
    // ── App aliases ─────────────────────────────────────────────────
    '--app-bg-base': 'var(--wa-bg-base)',
    '--app-bg-elevated': 'var(--wa-bg-elevated)',
    '--app-surface-subtle': 'var(--wa-surface-subtle)',
    '--app-surface-card': 'var(--wa-surface-card)',
    '--app-surface-hero': 'var(--wa-surface-hero)',
    '--app-border-subtle': 'var(--wa-border-subtle)',
    '--app-border-strong': 'var(--wa-border-strong)',
    '--app-text-primary': 'var(--wa-text-primary)',
    '--app-text-secondary': 'var(--wa-text-secondary)',
    '--app-text-muted': 'var(--wa-text-muted)',
    '--app-accent-primary': 'var(--wa-accent-primary)',
    '--app-accent-warm': 'var(--wa-accent-warm)',
    '--app-state-success': '#0f766e',
    '--app-state-warning': '#c98d24',
    '--app-state-danger': '#dc2626',
    '--app-shadow-card': 'var(--wa-shadow-card)',
    '--app-shadow-poster': 'var(--wa-shadow-poster)',
    '--app-shadow-overlay': 'var(--wa-shadow-hero)',
  },
  dark: {
    // ── Surfaces ────────────────────────────────────────────────────
    '--wa-bg-base': '#14171b',
    '--wa-bg-elevated': '#1a1f25',
    '--wa-surface-subtle': '#1c2128',
    '--wa-surface-card': '#1e2430',
    '--wa-surface-hero': '#232932',
    // ── Borders ─────────────────────────────────────────────────────
    '--wa-border-subtle': 'rgba(255, 255, 255, 0.07)',
    '--wa-border-strong': 'rgba(255, 255, 255, 0.16)',
    // ── Text ────────────────────────────────────────────────────────
    '--wa-text-primary': '#f1f5f9',
    '--wa-text-secondary': '#d1d8e2',
    '--wa-text-muted': '#9ca8b8',
    // ── Accent ──────────────────────────────────────────────────────
    '--wa-accent-primary': '#9bb5d4',
    '--wa-accent-warm': '#efb546',
    // ── Shadows ─────────────────────────────────────────────────────
    '--wa-shadow-card': '0 8px 24px rgba(0, 0, 0, 0.28)',
    '--wa-shadow-poster': '0 16px 48px rgba(0, 0, 0, 0.40)',
    '--wa-shadow-hero': '0 28px 80px rgba(0, 0, 0, 0.52)',
    // ── Mantine overrides ───────────────────────────────────────────
    '--mantine-color-body': '#14171b',
    '--mantine-color-text': '#f1f5f9',
    '--mantine-color-dimmed': '#9ca8b8',
    '--mantine-color-default': '#1e2430',
    '--mantine-color-default-hover': '#232932',
    '--mantine-color-default-border': 'rgba(255, 255, 255, 0.07)',
    // ── App aliases ─────────────────────────────────────────────────
    '--app-bg-base': 'var(--wa-bg-base)',
    '--app-bg-elevated': 'var(--wa-bg-elevated)',
    '--app-surface-subtle': 'var(--wa-surface-subtle)',
    '--app-surface-card': 'var(--wa-surface-card)',
    '--app-surface-hero': 'var(--wa-surface-hero)',
    '--app-border-subtle': 'var(--wa-border-subtle)',
    '--app-border-strong': 'var(--wa-border-strong)',
    '--app-text-primary': 'var(--wa-text-primary)',
    '--app-text-secondary': 'var(--wa-text-secondary)',
    '--app-text-muted': 'var(--wa-text-muted)',
    '--app-accent-primary': 'var(--wa-accent-primary)',
    '--app-accent-warm': 'var(--wa-accent-warm)',
    '--app-state-success': '#4fc3a1',
    '--app-state-warning': '#efb546',
    '--app-state-danger': '#ff6b6b',
    '--app-shadow-card': 'var(--wa-shadow-card)',
    '--app-shadow-poster': 'var(--wa-shadow-poster)',
    '--app-shadow-overlay': 'var(--wa-shadow-hero)',
  },
});

export const appTheme = createTheme({
  black: '#14171b',
  colors: {
    archive: archiveColors,
    ember: emberColors,
  },
  cursorType: 'pointer',
  defaultGradient: {
    deg: 135,
    from: 'archive.4',
    to: 'archive.7',
  },
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: appFontFamily,
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',
  fontSizes: {
    xs: 'var(--app-type-meta)',
    sm: 'var(--app-type-caption)',
    md: 'var(--app-type-body)',
    lg: '1.13rem',
    xl: '1.32rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '760',
    sizes: {
      h1: { fontSize: 'var(--app-type-h1)', lineHeight: '1.06' },
      h2: { fontSize: 'var(--app-type-h2)', lineHeight: '1.14' },
      h3: { fontSize: 'var(--app-type-h3)', lineHeight: '1.25' },
      h4: { fontSize: '1rem', lineHeight: '1.28' },
      h5: { fontSize: '0.94rem', lineHeight: '1.3' },
      h6: { fontSize: '0.86rem', lineHeight: '1.34' },
    },
    textWrap: 'balance',
  },
  lineHeights: {
    xs: '1.35',
    sm: '1.45',
    md: '1.55',
    lg: '1.65',
    xl: '1.75',
  },
  other: {
    captionSize: 'var(--app-type-caption)',
    contentWidth: 1240,
    displaySize: 'var(--app-type-display)',
    eyebrowSize: 'var(--app-type-meta)',
    metaSize: 'var(--app-type-caption)',
    narrowContentWidth: 760,
    shellWidth: 1360,
  },
  primaryColor: 'archive',
  primaryShade: { dark: 3, light: 6 },
  radius: {
    xs: '0.25rem',
    sm: '0.45rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },
  respectReducedMotion: true,
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.10)',
    sm: 'var(--wa-shadow-card)',
    md: 'var(--wa-shadow-poster)',
    lg: 'var(--wa-shadow-hero)',
    xl: '0 36px 100px rgba(0, 0, 0, 0.50)',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.75rem',
  },
  components: {
    ActionIcon: {
      defaultProps: { radius: 'md', variant: 'default' },
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-subtle)',
          borderColor: 'var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
          transition: 'border-color 160ms ease, background 160ms ease',
        },
      },
    },
    Badge: {
      defaultProps: { radius: 'xl', variant: 'light' },
      styles: {
        root: {
          border: '1px solid transparent',
          fontSize: 'var(--app-type-meta)',
          fontWeight: 700,
          letterSpacing: 0,
          paddingInline: '0.65rem',
          textTransform: 'none',
        },
      },
    },
    Button: {
      defaultProps: { radius: 'md', size: 'sm' },
      styles: {
        root: {
          borderColor: 'var(--app-border-subtle)',
          fontWeight: 700,
          letterSpacing: 0,
          paddingInline: '1rem',
          transition:
            'transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease',
        },
      },
    },
    Input: {
      styles: {
        input: {
          backgroundColor: 'var(--app-bg-elevated)',
          borderColor: 'var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
          transition: 'border-color 160ms ease',
        },
      },
    },
    InputWrapper: {
      styles: {
        description: { color: 'var(--app-text-muted)' },
        label: {
          color: 'var(--app-text-primary)',
          fontWeight: 700,
          marginBottom: '0.4rem',
        },
      },
    },
    NativeSelect: { defaultProps: { radius: 'md', size: 'md' } },
    NumberInput: { defaultProps: { radius: 'md', size: 'md' } },
    Paper: {
      defaultProps: { radius: 'lg', withBorder: true },
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-card)',
          borderColor: 'var(--app-border-subtle)',
          boxShadow: 'none',
        },
      },
    },
    SegmentedControl: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          backgroundColor: 'var(--app-bg-elevated)',
          border: '1px solid var(--app-border-subtle)',
        },
      },
    },
    Select: { defaultProps: { radius: 'md', size: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md', size: 'md' } },
    TextInput: { defaultProps: { radius: 'md', size: 'md' } },
    Textarea: {
      defaultProps: { autosize: true, minRows: 3, radius: 'md', size: 'md' },
    },
    Title: {
      styles: {
        root: { color: 'var(--app-text-primary)', letterSpacing: '-0.02em' },
      },
    },
    Tooltip: {
      defaultProps: { radius: 'md', withArrow: true },
    },
  },
});
