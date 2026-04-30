import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

const archiveColors: MantineColorsTuple = [
  '#eef7fb',
  '#dcecf4',
  '#c7deec',
  '#adcade',
  '#8fb0c4',
  '#7094aa',
  '#5e7a8c',
  '#476274',
  '#354b5a',
  '#243844',
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
    '--app-surface-radius': theme.radius.md,
    '--app-surface-radius-sm': theme.radius.sm,
    '--app-transition-fast': '160ms ease',
  },
  light: {
    '--app-shell-bg': '#f5f6f8',
    '--app-shell-muted-bg': '#eceef2',
    '--app-surface-0': '#ffffff',
    '--app-surface-1': '#f7f8fa',
    '--app-surface-2': '#eef1f5',
    '--app-border-color': '#d7dde5',
    '--app-border-strong': '#b9c4d1',
    '--app-text-strong': '#18212d',
    '--app-text-secondary': '#445263',
    '--app-text-muted': '#6b7888',
    '--app-accent': '#3d6390',
    '--app-accent-soft': 'rgba(61, 99, 144, 0.1)',
    '--app-danger-soft': 'rgba(220, 38, 38, 0.12)',
  },
  dark: {
    '--app-shell-bg': '#0c0e10',
    '--app-shell-muted-bg': '#111416',
    '--app-surface-0': '#15191d',
    '--app-surface-1': '#1a1f24',
    '--app-surface-2': '#20262c',
    '--app-border-color': 'rgba(173, 202, 222, 0.14)',
    '--app-border-strong': 'rgba(173, 202, 222, 0.28)',
    '--app-text-strong': '#f3f6f7',
    '--app-text-secondary': '#c7d0d7',
    '--app-text-muted': '#94a0aa',
    '--app-accent': '#adcade',
    '--app-accent-soft': 'rgba(173, 202, 222, 0.14)',
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
    from: 'archive.2',
    to: 'archive.6',
  },
  defaultRadius: 'md',
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
        fontSize: 'clamp(1.9rem, 4vw, 2.45rem)',
        lineHeight: '1.08',
      },
      h2: {
        fontSize: 'clamp(1.34rem, 3vw, 1.72rem)',
        lineHeight: '1.14',
      },
      h3: {
        fontSize: '1.08rem',
        lineHeight: '1.24',
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
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
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
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
  components: {
    Accordion: {
      defaultProps: {
        radius: 'lg',
        variant: 'contained',
      },
      styles: {
        content: {
          backgroundColor: 'transparent',
        },
        control: {
          backgroundColor: 'var(--app-surface-1)',
          borderRadius: '0.95rem',
          color: 'var(--app-text-strong)',
          fontWeight: 600,
        },
        item: {
          backgroundColor: 'transparent',
          border: 'none',
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
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
        radius: 'sm',
        variant: 'light',
      },
      styles: {
        root: {
          border: '1px solid transparent',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: 0,
          paddingInline: '0.55rem',
          textTransform: 'uppercase',
        },
      },
    },
    Button: {
      defaultProps: {
        radius: 'sm',
        size: 'sm',
      },
      styles: {
        root: {
          borderColor: 'var(--app-border-color)',
          fontWeight: 600,
          letterSpacing: 0,
          paddingInline: '0.9rem',
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
        radius: 'md',
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
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-1)',
          border: '1px solid var(--app-border-color)',
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
          letterSpacing: 0,
        },
      },
    },
  },
});
