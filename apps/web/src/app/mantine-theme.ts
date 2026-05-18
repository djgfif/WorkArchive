import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

const archiveColors: MantineColorsTuple = [
  '#f3f0ff',
  '#e4dcff',
  '#c9bcff',
  '#aa99f5',
  '#8a78dd',
  '#6f5fc2',
  '#5a4ca0',
  '#473e7f',
  '#373363',
  '#282746',
];

const emberColors: MantineColorsTuple = [
  '#fff7e5',
  '#ffe9bd',
  '#ffd782',
  '#f6bd46',
  '#d99a24',
  '#b87815',
  '#935d12',
  '#744a14',
  '#5a3b15',
  '#3f2b13',
];

const appFontFamily =
  '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif';

export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

export const appCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    '--mantine-color-body': '#08090d',
    '--mantine-color-text': '#f4f1eb',
    '--mantine-color-dimmed': 'rgba(244, 241, 235, 0.62)',
    '--mantine-color-default': '#12141d',
    '--mantine-color-default-hover': '#181b26',
    '--mantine-color-default-border': 'rgba(255, 255, 255, 0.09)',
  },
});

export const appTheme = createTheme({
  black: '#08090d',
  colors: {
    archive: archiveColors,
    ember: emberColors,
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
    xs: '0.78rem',
    sm: '0.9rem',
    md: '1rem',
    lg: '1.13rem',
    xl: '1.32rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '700',
    sizes: {
      h1: {
        fontSize: 'clamp(2.2rem, 5vw, 4.2rem)',
        lineHeight: '1.08',
      },
      h2: {
        fontSize: 'clamp(1.45rem, 3vw, 2.05rem)',
        lineHeight: '1.14',
      },
      h3: {
        fontSize: '1.16rem',
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
    captionSize: '0.82rem',
    contentWidth: 1240,
    displaySize: 'clamp(2.7rem, 7vw, 5.8rem)',
    eyebrowSize: '0.76rem',
    metaSize: '0.84rem',
    narrowContentWidth: 760,
    shellWidth: 1360,
  },
  primaryColor: 'archive',
  primaryShade: {
    dark: 4,
    light: 6,
  },
  radius: {
    xs: '0.25rem',
    sm: '0.45rem',
    md: '0.7rem',
    lg: '1rem',
    xl: '1.4rem',
  },
  respectReducedMotion: true,
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.18)',
    sm: '0 10px 28px rgba(0, 0, 0, 0.22)',
    md: '0 18px 48px rgba(0, 0, 0, 0.28)',
    lg: '0 26px 80px rgba(0, 0, 0, 0.34)',
    xl: '0 36px 110px rgba(0, 0, 0, 0.42)',
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
        radius: 'xl',
        variant: 'light',
      },
      styles: {
        root: {
          border: '1px solid transparent',
          fontSize: 'var(--mantine-font-size-xs)',
          fontWeight: 600,
          letterSpacing: 0,
          paddingInline: '0.65rem',
          textTransform: 'none',
        },
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
      },
      styles: {
        root: {
          borderColor: 'var(--mantine-color-default-border)',
          fontWeight: 600,
          letterSpacing: 0,
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
    NumberInput: {
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
        radius: 'lg',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-body)',
          borderColor: 'var(--mantine-color-default-border)',
          boxShadow: 'var(--mantine-shadow-xs)',
        },
      },
    },
    SegmentedControl: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-default)',
          border: '1px solid var(--mantine-color-default-border)',
        },
      },
    },
    Select: {
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
