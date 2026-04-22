import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

const archiveColors: MantineColorsTuple = [
  '#ebf6ff',
  '#d8eafe',
  '#aed5fb',
  '#80bdf9',
  '#58aaf8',
  '#3f9df7',
  '#2c8fe2',
  '#1874b6',
  '#0d598c',
  '#023d62',
];

const appFontFamily =
  '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif';

export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

export const appCssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    '--app-shell-padding': 'clamp(1rem, 2vw, 1.5rem)',
    '--app-shell-width': '85rem',
    '--app-content-width': '77.5rem',
    '--app-content-width-narrow': '47.5rem',
    '--app-surface-radius': theme.radius.xl,
    '--app-surface-radius-sm': theme.radius.md,
    '--app-transition-fast': '160ms ease',
  },
  light: {
    '--app-shell-bg': '#f3f5f8',
    '--app-shell-muted-bg': '#eef2f6',
    '--app-surface-0': '#ffffff',
    '--app-surface-1': '#f8fafc',
    '--app-surface-2': '#eef3f7',
    '--app-border-color': '#d8e1ea',
    '--app-border-strong': '#c2cdda',
    '--app-text-strong': '#132033',
    '--app-text-secondary': '#42546a',
    '--app-text-muted': '#67768c',
    '--app-accent': '#1874b6',
    '--app-accent-soft': 'rgba(24, 116, 182, 0.12)',
    '--app-danger-soft': 'rgba(220, 38, 38, 0.12)',
  },
  dark: {
    '--app-shell-bg': '#121212',
    '--app-shell-muted-bg': '#18191d',
    '--app-surface-0': '#1c1c1e',
    '--app-surface-1': '#232427',
    '--app-surface-2': '#2a2c31',
    '--app-border-color': 'rgba(255, 255, 255, 0.08)',
    '--app-border-strong': 'rgba(255, 255, 255, 0.14)',
    '--app-text-strong': '#f5f7fa',
    '--app-text-secondary': '#d0d5dd',
    '--app-text-muted': '#98a2b3',
    '--app-accent': '#7cc7ff',
    '--app-accent-soft': 'rgba(124, 199, 255, 0.16)',
    '--app-danger-soft': 'rgba(248, 113, 113, 0.18)',
  },
});

export const appTheme = createTheme({
  black: '#121212',
  colors: {
    archive: archiveColors,
  },
  cursorType: 'pointer',
  defaultGradient: {
    deg: 135,
    from: 'archive.5',
    to: 'archive.7',
  },
  defaultRadius: 'xl',
  focusRing: 'auto',
  fontFamily: appFontFamily,
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',
  fontSizes: {
    xs: '0.78rem',
    sm: '0.92rem',
    md: '1rem',
    lg: '1.12rem',
    xl: '1.3rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '700',
    sizes: {
      h1: {
        fontSize: 'clamp(2rem, 4vw, 2.75rem)',
        lineHeight: '1.08',
      },
      h2: {
        fontSize: 'clamp(1.45rem, 3vw, 2rem)',
        lineHeight: '1.12',
      },
      h3: {
        fontSize: '1.22rem',
        lineHeight: '1.22',
      },
      h4: {
        fontSize: '1.05rem',
        lineHeight: '1.28',
      },
      h5: {
        fontSize: '0.96rem',
        lineHeight: '1.3',
      },
      h6: {
        fontSize: '0.88rem',
        lineHeight: '1.34',
      },
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
    contentWidth: 1240,
    narrowContentWidth: 760,
    shellWidth: 1360,
  },
  primaryColor: 'archive',
  primaryShade: {
    dark: 4,
    light: 6,
  },
  radius: {
    xs: '0.75rem',
    sm: '0.95rem',
    md: '1.12rem',
    lg: '1.35rem',
    xl: '1.75rem',
  },
  respectReducedMotion: true,
  shadows: {
    xs: 'none',
    sm: 'none',
    md: 'none',
    lg: 'none',
    xl: 'none',
  },
  spacing: {
    xs: '0.625rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.75rem',
  },
  components: {
    ActionIcon: {
      defaultProps: {
        radius: 'xl',
        variant: 'default',
      },
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
          color: 'var(--app-text-strong)',
        },
      },
    },
    Alert: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
      },
    },
    Button: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
      },
    },
    NativeSelect: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
          color: 'var(--app-text-strong)',
        },
        label: {
          color: 'var(--app-text-secondary)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-0)',
          borderColor: 'var(--app-border-color)',
          boxShadow: 'none',
        },
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
          color: 'var(--app-text-strong)',
        },
        label: {
          color: 'var(--app-text-secondary)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
        innerInput: {
          color: 'var(--app-text-strong)',
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
          color: 'var(--app-text-strong)',
        },
        label: {
          color: 'var(--app-text-secondary)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
      },
    },
    Textarea: {
      defaultProps: {
        autosize: true,
        minRows: 3,
        radius: 'xl',
        size: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
          color: 'var(--app-text-strong)',
        },
        label: {
          color: 'var(--app-text-secondary)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
      },
    },
    Title: {
      styles: {
        root: {
          color: 'var(--app-text-strong)',
          letterSpacing: '-0.03em',
        },
      },
    },
  },
});
