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
    '--app-surface-radius': theme.radius.lg,
    '--app-surface-radius-sm': theme.radius.md,
    '--app-transition-fast': '160ms ease',
  },
  light: {
    '--app-shell-bg': '#f2f4f8',
    '--app-shell-muted-bg': '#e9edf3',
    '--app-surface-0': '#ffffff',
    '--app-surface-1': '#f7f9fc',
    '--app-surface-2': '#eef2f7',
    '--app-border-color': '#d6dde7',
    '--app-border-strong': '#bcc8d7',
    '--app-text-strong': '#152033',
    '--app-text-secondary': '#475569',
    '--app-text-muted': '#66778d',
    '--app-accent': '#1874b6',
    '--app-accent-soft': 'rgba(24, 116, 182, 0.12)',
    '--app-danger-soft': 'rgba(220, 38, 38, 0.12)',
  },
  dark: {
    '--app-shell-bg': '#101317',
    '--app-shell-muted-bg': '#161b20',
    '--app-surface-0': '#1b2026',
    '--app-surface-1': '#222831',
    '--app-surface-2': '#2a313b',
    '--app-border-color': 'rgba(255, 255, 255, 0.08)',
    '--app-border-strong': 'rgba(255, 255, 255, 0.16)',
    '--app-text-strong': '#f4f7fb',
    '--app-text-secondary': '#d2dae5',
    '--app-text-muted': '#9aa7b8',
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
  defaultRadius: 'lg',
  focusRing: 'auto',
  fontFamily: appFontFamily,
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',
  fontSizes: {
    xs: '0.8rem',
    sm: '0.93rem',
    md: '1rem',
    lg: '1.08rem',
    xl: '1.24rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '700',
    sizes: {
      h1: {
        fontSize: 'clamp(2rem, 4vw, 2.6rem)',
        lineHeight: '1.08',
      },
      h2: {
        fontSize: 'clamp(1.42rem, 3vw, 1.9rem)',
        lineHeight: '1.12',
      },
      h3: {
        fontSize: '1.18rem',
        lineHeight: '1.22',
      },
      h4: {
        fontSize: '1.02rem',
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
    xs: '0.625rem',
    sm: '0.8rem',
    md: '0.95rem',
    lg: '1.15rem',
    xl: '1.45rem',
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
        radius: 'lg',
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
        radius: 'lg',
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
          border: '1px solid transparent',
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
        size: 'md',
      },
      styles: {
        root: {
          borderColor: 'var(--app-border-color)',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          paddingInline: '1rem',
        },
      },
    },
    Checkbox: {
      styles: {
        body: {
          alignItems: 'center',
        },
        label: {
          color: 'var(--app-text-secondary)',
          fontWeight: 500,
        },
      },
    },
    NativeSelect: {
      defaultProps: {
        radius: 'md',
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
        radius: 'lg',
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
        radius: 'md',
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
        radius: 'md',
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
        radius: 'md',
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
