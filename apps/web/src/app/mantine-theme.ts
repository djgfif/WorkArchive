import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

const archiveColors: MantineColorsTuple = [
  '#eef7fb',
  '#dcecf4',
  '#c9e7fb',
  '#bbd8ed',
  '#adcade',
  '#8fb0c4',
  '#6f91a6',
  '#587487',
  '#425d6f',
  '#314b5b',
];

const appFontFamily =
  '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif';

export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

export const appCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {},
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
  defaultRadius: 'sm',
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
        radius: 'md',
        variant: 'contained',
      },
      styles: {
        content: {
          backgroundColor: 'transparent',
        },
        control: {
          backgroundColor: 'var(--mantine-color-default)',
          borderRadius: 'var(--mantine-radius-md)',
          color: 'var(--mantine-color-text)',
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
          backgroundColor: 'var(--mantine-color-default)',
          borderColor: 'var(--mantine-color-default-border)',
          color: 'var(--mantine-color-text)',
        },
      },
    },
    Alert: {
      defaultProps: {
        radius: 'md',
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
          borderColor: 'var(--mantine-color-default-border)',
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
          color: 'var(--mantine-color-text)',
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
          backgroundColor: 'var(--mantine-color-default)',
          borderColor: 'var(--mantine-color-default-border)',
          color: 'var(--mantine-color-text)',
          boxShadow: 'none',
        },
        label: {
          color: 'var(--mantine-color-text)',
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
          backgroundColor: 'var(--mantine-color-body)',
          borderColor: 'var(--mantine-color-default-border)',
          boxShadow: 'none',
        },
      },
    },
    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-default)',
          border: '1px solid var(--mantine-color-default-border)',
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
          backgroundColor: 'var(--mantine-color-default)',
          borderColor: 'var(--mantine-color-default-border)',
          color: 'var(--mantine-color-text)',
          boxShadow: 'none',
        },
        label: {
          color: 'var(--mantine-color-text)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
        innerInput: {
          color: 'var(--mantine-color-text)',
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
          backgroundColor: 'var(--mantine-color-default)',
          borderColor: 'var(--mantine-color-default-border)',
          color: 'var(--mantine-color-text)',
          boxShadow: 'none',
        },
        label: {
          color: 'var(--mantine-color-text)',
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
          backgroundColor: 'var(--mantine-color-default)',
          borderColor: 'var(--mantine-color-default-border)',
          color: 'var(--mantine-color-text)',
          boxShadow: 'none',
        },
        label: {
          color: 'var(--mantine-color-text)',
          fontWeight: 600,
          marginBottom: '0.4rem',
        },
      },
    },
    Title: {
      styles: {
        root: {
          color: 'var(--mantine-color-text)',
          letterSpacing: 0,
        },
      },
    },
  },
});
