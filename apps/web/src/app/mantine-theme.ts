import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

// Archive Blue 팔레트 — 개발 가이드 v2.0.0 (Tailwind Blue 계열, 프리미엄 다크 최적화)
const archiveColors: MantineColorsTuple = [
  '#eff6ff', // 0 — lightest tint
  '#dbeafe', // 1
  '#bfdbfe', // 2
  '#93c5fd', // 3 — dark mode accent
  '#60a5fa', // 4 — dark mode primary
  '#3b82f6', // 5
  '#2563eb', // 6 — light mode primary
  '#1d4ed8', // 7
  '#1e40af', // 8
  '#1e3a8a', // 9 — darkest
];

// Ember (황금빛 강조) 팔레트 — Tailwind Amber 계열
const emberColors: MantineColorsTuple = [
  '#fffbeb',
  '#fef3c7',
  '#fde68a',
  '#fcd34d',
  '#fbbf24',
  '#f59e0b',
  '#d97706',
  '#b45309',
  '#92400e',
  '#78350f',
];

const appFontFamily =
  '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif';

export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

export const appCssVariablesResolver: CSSVariablesResolver = (_theme) => ({
  variables: {
    // ── Motion ──────────────────────────────────────────────────────
    '--wa-motion-fast': '140ms ease',
    '--wa-motion-normal': '200ms ease',
    '--wa-motion-spring': '300ms cubic-bezier(0.25, 1, 0.5, 1)',
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
    '--wa-bg-shell': '#f8fafc',
    '--wa-bg-base': '#f1f5f9',
    '--wa-bg-elevated': '#e8edf3',
    '--wa-surface-subtle': '#eef1f5',
    '--wa-surface-card': '#ffffff',
    '--wa-surface-hero': '#f7f9fb',
    // ── Borders ─────────────────────────────────────────────────────
    '--wa-border-subtle': '#e2e8f0',
    '--wa-border-strong': '#cbd5e1',
    // ── Text ────────────────────────────────────────────────────────
    '--wa-text-primary': '#0f172a',
    '--wa-text-secondary': '#334155',
    '--wa-text-muted': '#64748b',
    // ── Accent ──────────────────────────────────────────────────────
    '--wa-accent-primary': '#2563eb',
    '--wa-accent-warm': '#d97706',
    // ── Shadows ─────────────────────────────────────────────────────
    '--wa-shadow-card': '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    '--wa-shadow-poster': '0 4px 16px rgba(0,0,0,0.10)',
    '--wa-shadow-hero': '0 8px 32px rgba(0,0,0,0.12)',
    // ── Mantine overrides ───────────────────────────────────────────
    '--mantine-color-body': '#f8fafc',
    '--mantine-color-text': '#0f172a',
    '--mantine-color-dimmed': '#64748b',
    '--mantine-color-default': '#ffffff',
    '--mantine-color-default-hover': '#f1f5f9',
    '--mantine-color-default-border': '#e2e8f0',
    // ── App aliases ─────────────────────────────────────────────────
    '--app-bg-shell': 'var(--wa-bg-shell)',
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
    '--app-state-warning': '#d97706',
    '--app-state-danger': '#dc2626',
    '--app-shadow-card': 'var(--wa-shadow-card)',
    '--app-shadow-poster': 'var(--wa-shadow-poster)',
    '--app-shadow-overlay': 'var(--wa-shadow-hero)',
  },
  dark: {
    // ── Surfaces — 순수 블랙 대신 블루-그레이 계열로 깊이감 부여 ──────────
    '--wa-bg-shell': '#0c0e12',
    '--wa-bg-base': '#13161c',
    '--wa-bg-elevated': '#1a1e26',
    '--wa-surface-subtle': '#1c2028',
    '--wa-surface-card': '#1e2430',
    '--wa-surface-hero': '#222a36',
    // ── Borders — 미세한 명도 차이만으로 계층 구분 ──────────────────────
    '--wa-border-subtle': 'rgba(255, 255, 255, 0.06)',
    '--wa-border-strong': 'rgba(255, 255, 255, 0.12)',
    // ── Text ────────────────────────────────────────────────────────
    '--wa-text-primary': '#f1f5f9',
    '--wa-text-secondary': '#cbd5e1',
    '--wa-text-muted': '#94a3b8',
    // ── Accent — 다크 모드에서 더 밝은 파랑 사용 ────────────────────────
    '--wa-accent-primary': '#60a5fa',
    '--wa-accent-warm': '#fbbf24',
    // ── Shadows — 다크 모드에서 더 강한 그림자 ──────────────────────────
    '--wa-shadow-card': '0 4px 16px rgba(0,0,0,0.32)',
    '--wa-shadow-poster': '0 8px 32px rgba(0,0,0,0.48)',
    '--wa-shadow-hero': '0 16px 56px rgba(0,0,0,0.60)',
    // ── Mantine overrides ───────────────────────────────────────────
    '--mantine-color-body': '#0c0e12',
    '--mantine-color-text': '#f1f5f9',
    '--mantine-color-dimmed': '#94a3b8',
    '--mantine-color-default': '#1e2430',
    '--mantine-color-default-hover': '#222a36',
    '--mantine-color-default-border': 'rgba(255, 255, 255, 0.06)',
    // ── App aliases ─────────────────────────────────────────────────
    '--app-bg-shell': 'var(--wa-bg-shell)',
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
    '--app-state-success': '#2dd4bf',
    '--app-state-warning': '#fbbf24',
    '--app-state-danger': '#f87171',
    '--app-shadow-card': 'var(--wa-shadow-card)',
    '--app-shadow-poster': 'var(--wa-shadow-poster)',
    '--app-shadow-overlay': 'var(--wa-shadow-hero)',
  },
});

export const appTheme = createTheme({
  black: '#0c0e12',
  colors: {
    archive: archiveColors,
    ember: emberColors,
  },
  cursorType: 'pointer',
  defaultGradient: {
    deg: 135,
    from: 'archive.5',
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
          transition: 'border-color var(--wa-motion-fast), background var(--wa-motion-fast)',
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
            'transform var(--wa-motion-fast), border-color var(--wa-motion-fast), background var(--wa-motion-fast), color var(--wa-motion-fast)',
        },
      },
    },
    Input: {
      styles: {
        input: {
          backgroundColor: 'var(--app-bg-elevated)',
          borderColor: 'var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
          transition: 'border-color var(--wa-motion-fast)',
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
