import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

const archiveColors: MantineColorsTuple = [
  '#f5f1ff',
  '#e5dcff',
  '#cbbcff',
  '#a998f0',
  '#8a78db',
  '#6f5fc2',
  '#594b9b',
  '#453b77',
  '#342f58',
  '#24233a',
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

export const appCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--wa-bg-base': '#07080b',
    '--wa-bg-elevated': '#0c0e14',
    '--wa-surface-subtle': '#10131b',
    '--wa-surface-card': '#151924',
    '--wa-surface-hero': '#181b27',
    '--wa-border-subtle': 'rgba(255, 255, 255, 0.075)',
    '--wa-border-strong': 'rgba(255, 255, 255, 0.16)',
    '--wa-text-primary': '#f5f1ea',
    '--wa-text-secondary': 'rgba(245, 241, 234, 0.74)',
    '--wa-text-muted': 'rgba(245, 241, 234, 0.58)',
    '--wa-accent-primary': '#a998f0',
    '--wa-accent-warm': '#efb546',
    '--wa-shadow-card': '0 14px 36px rgba(0, 0, 0, 0.28)',
    '--wa-shadow-poster': '0 22px 60px rgba(0, 0, 0, 0.42)',
    '--wa-shadow-hero': '0 34px 100px rgba(0, 0, 0, 0.54)',
    '--wa-motion-fast': '140ms ease',
    '--wa-motion-normal': '190ms ease',
    '--wa-type-display': 'clamp(2.7rem, 8vw, 6rem)',
    '--wa-type-h1': 'clamp(2.15rem, 5vw, 4.1rem)',
    '--wa-type-h2': 'clamp(1.45rem, 3vw, 2.15rem)',
    '--wa-type-h3': '1.08rem',
    '--wa-type-body': '1rem',
    '--wa-type-caption': '0.84rem',
    '--wa-type-meta': '0.76rem',
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
    '--app-space-page': 'clamp(1.25rem, 3vw, 2.5rem)',
    '--app-space-section': 'clamp(2rem, 5vw, 4.5rem)',
    '--app-space-card': 'clamp(1rem, 2.4vw, 1.5rem)',
    '--app-space-control': '0.75rem',
    '--app-type-display': 'var(--wa-type-display)',
    '--app-type-h1': 'var(--wa-type-h1)',
    '--app-type-h2': 'var(--wa-type-h2)',
    '--app-type-h3': 'var(--wa-type-h3)',
    '--app-type-body': 'var(--wa-type-body)',
    '--app-type-caption': 'var(--wa-type-caption)',
    '--app-type-meta': 'var(--wa-type-meta)',
  },
  light: {
    '--mantine-color-body': '#f4f1eb',
    '--mantine-color-text': '#17151c',
    '--mantine-color-dimmed': 'rgba(23, 21, 28, 0.62)',
    '--mantine-color-default': '#ffffff',
    '--mantine-color-default-hover': '#f3f0ea',
    '--mantine-color-default-border': 'rgba(23, 21, 28, 0.12)',
  },
  dark: {
    '--mantine-color-body': 'var(--wa-bg-base)',
    '--mantine-color-text': 'var(--wa-text-primary)',
    '--mantine-color-dimmed': 'var(--wa-text-secondary)',
    '--mantine-color-default': 'var(--wa-surface-card)',
    '--mantine-color-default-hover': '#1a1f2c',
    '--mantine-color-default-border': 'var(--wa-border-subtle)',
  },
});

export const appTheme = createTheme({
  black: '#07080b',
  colors: {
    archive: archiveColors,
    ember: emberColors,
  },
  cursorType: 'pointer',
  defaultGradient: {
    deg: 135,
    from: 'archive.3',
    to: 'archive.6',
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
  primaryShade: { dark: 4, light: 6 },
  radius: {
    xs: '0.25rem',
    sm: '0.45rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },
  respectReducedMotion: true,
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.18)',
    sm: 'var(--wa-shadow-card)',
    md: 'var(--wa-shadow-poster)',
    lg: 'var(--wa-shadow-hero)',
    xl: '0 42px 120px rgba(0, 0, 0, 0.58)',
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
        root: { color: 'var(--app-text-primary)', letterSpacing: 0 },
      },
    },
  },
});
