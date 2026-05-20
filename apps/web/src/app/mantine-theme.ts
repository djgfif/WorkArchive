/**
 * Work Archive — Mantine Theme v3.0.0
 * "Calm Premium Dark" — Linear·Vercel·Apple TV+ 수준의 프리미엄 다크 UI
 *
 * 설계 원칙
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. 색상 계층: Shell(최하) → Elevated → Card → Overlay(최상)
 * 2. 텍스트 계층: Primary → Secondary → Muted → Disabled
 * 3. 테두리 계층: Subtle → Default → Strong → Focus(accent)
 * 4. 모션: spring(0.16,1,0.3,1) — 빠른 응답 + 자연스러운 감속
 * 5. 그림자: 색상 있는 그림자(tinted shadow) — 순수 검정 피하기
 */

import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

/* ── 폰트 ─────────────────────────────────────────────────────────────────── */
const appFontFamily =
  '"Pretendard Variable", Pretendard, "IBM Plex Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/* ── Archive Blue 팔레트 (Tailwind Blue 기반, 다크 모드 최적화) ─────────────── */
const archiveColors: MantineColorsTuple = [
  '#eff6ff', // 0 — 라이트 배경
  '#dbeafe', // 1 — 라이트 표면
  '#bfdbfe', // 2 — 라이트 강조
  '#93c5fd', // 3 — 다크 모드 텍스트 강조
  '#60a5fa', // 4 — 다크 모드 링크
  '#3b82f6', // 5 — Primary (다크 모드 기본)
  '#2563eb', // 6 — Primary (라이트 모드 기본)
  '#1d4ed8', // 7 — Hover
  '#1e40af', // 8 — Active / Pressed
  '#1e3a8a', // 9 — 깊은 배경 강조
];

/* ── Ember (Warm Amber) 팔레트 — 별점·즐겨찾기 강조 ────────────────────────── */
const emberColors: MantineColorsTuple = [
  '#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
  '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f',
];

/* ── Color Scheme Manager ─────────────────────────────────────────────────── */
export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

/* ── CSS 변수 리졸버 ─────────────────────────────────────────────────────── */
export const appCssVariablesResolver: CSSVariablesResolver = (_theme) => ({
  variables: {
    /* ── 모션 시스템 — spring 곡선 전면 적용 ── */
    '--wa-motion-instant':  '80ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-fast':     '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-normal':   '240ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-slow':     '380ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-enter':    '300ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-exit':     '180ms cubic-bezier(0.4, 0, 1, 1)',
    /* 하위 호환 alias */
    '--wa-motion-spring':   '300ms cubic-bezier(0.16, 1, 0.3, 1)',

    /* ── 타이포그래피 스케일 ── */
    '--wa-type-display': 'clamp(2.4rem, 7vw, 5.2rem)',
    '--wa-type-h1':      'clamp(1.9rem, 4.5vw, 3.6rem)',
    '--wa-type-h2':      'clamp(1.35rem, 2.8vw, 2rem)',
    '--wa-type-h3':      '1.08rem',
    '--wa-type-body':    '1rem',
    '--wa-type-caption': '0.84rem',
    '--wa-type-meta':    '0.76rem',
    /* aliases */
    '--app-type-display': 'var(--wa-type-display)',
    '--app-type-h1':      'var(--wa-type-h1)',
    '--app-type-h2':      'var(--wa-type-h2)',
    '--app-type-h3':      'var(--wa-type-h3)',
    '--app-type-body':    'var(--wa-type-body)',
    '--app-type-caption': 'var(--wa-type-caption)',
    '--app-type-meta':    'var(--wa-type-meta)',

    /* ── 여백 스케일 ── */
    '--app-space-page':    'clamp(1.25rem, 3vw, 2.5rem)',
    '--app-space-section': 'clamp(2rem, 5vw, 4rem)',
    '--app-space-card':    'clamp(1rem, 2.4vw, 1.5rem)',
    '--app-space-control': '0.75rem',
  },

  /* ── 라이트 모드 ── */
  light: {
    '--wa-bg-shell':        '#f8fafc',
    '--wa-bg-base':         '#f1f5f9',
    '--wa-bg-elevated':     '#e8edf3',
    '--wa-surface-subtle':  '#eef1f5',
    '--wa-surface-card':    '#ffffff',
    '--wa-surface-hero':    '#f7f9fb',
    '--wa-surface-overlay': '#ffffff',

    '--wa-border-subtle':   'rgba(15, 23, 42, 0.07)',
    '--wa-border-default':  'rgba(15, 23, 42, 0.12)',
    '--wa-border-strong':   'rgba(15, 23, 42, 0.20)',

    '--wa-text-primary':    '#0f172a',
    '--wa-text-secondary':  '#334155',
    '--wa-text-muted':      '#64748b',
    '--wa-text-disabled':   '#cbd5e1',

    '--wa-accent-primary':  '#2563eb',
    '--wa-accent-strong':   '#1d4ed8',
    '--wa-accent-warm':     '#d97706',
    '--wa-accent-teal':     '#0d9488',
    '--wa-accent-rose':     '#e11d48',

    '--wa-shadow-xs':     '0 1px 2px rgba(15, 23, 42, 0.06)',
    '--wa-shadow-card':   '0 1px 4px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.05)',
    '--wa-shadow-poster': '0 4px 16px rgba(15, 23, 42, 0.12), 0 1px 4px rgba(15, 23, 42, 0.06)',
    '--wa-shadow-hero':   '0 8px 32px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06)',
    '--wa-shadow-overlay':'0 16px 48px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.07)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(37, 99, 235, 0.20)',

    '--mantine-color-body':           '#f8fafc',
    '--mantine-color-text':           '#0f172a',
    '--mantine-color-dimmed':         '#64748b',
    '--mantine-color-default':        '#ffffff',
    '--mantine-color-default-hover':  '#f1f5f9',
    '--mantine-color-default-border': 'rgba(15, 23, 42, 0.12)',

    '--app-bg-shell':        'var(--wa-bg-shell)',
    '--app-bg-base':         'var(--wa-bg-base)',
    '--app-bg-elevated':     'var(--wa-bg-elevated)',
    '--app-surface-default': 'var(--wa-surface-card)',
    '--app-surface-subtle':  'var(--wa-surface-subtle)',
    '--app-surface-card':    'var(--wa-surface-card)',
    '--app-surface-hero':    'var(--wa-surface-hero)',
    '--app-surface-overlay': 'var(--wa-surface-overlay)',
    '--app-border-subtle':   'var(--wa-border-subtle)',
    '--app-border-default':  'var(--wa-border-default)',
    '--app-border-strong':   'var(--wa-border-strong)',
    '--app-text-primary':    'var(--wa-text-primary)',
    '--app-text-secondary':  'var(--wa-text-secondary)',
    '--app-text-muted':      'var(--wa-text-muted)',
    '--app-text-disabled':   'var(--wa-text-disabled)',
    '--app-accent-primary':  'var(--wa-accent-primary)',
    '--app-accent-strong':   'var(--wa-accent-strong)',
    '--app-accent-secondary':'var(--wa-accent-teal)',
    '--app-accent-warm':     'var(--wa-accent-warm)',
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#0f766e',
    '--app-state-warning':   '#d97706',
    '--app-state-danger':    '#dc2626',
    '--app-state-info':      '#2563eb',
    '--app-shadow-card':     'var(--wa-shadow-card)',
    '--app-shadow-poster':   'var(--wa-shadow-poster)',
    '--app-shadow-overlay':  'var(--wa-shadow-overlay)',
    '--app-shadow-glow':     'var(--wa-shadow-glow)',
  },

  /* ── 다크 모드 ── */
  dark: {
    '--wa-bg-shell':        '#05070d',
    '--wa-bg-base':         '#080c16',
    '--wa-bg-elevated':     '#0d1424',
    '--wa-surface-subtle':  '#111a2e',
    '--wa-surface-card':    '#16213a',
    '--wa-surface-hero':    '#10192d',
    '--wa-surface-overlay': '#111827',

    '--wa-border-subtle':   'rgba(148, 163, 184, 0.08)',
    '--wa-border-default':  'rgba(148, 163, 184, 0.16)',
    '--wa-border-strong':   'rgba(148, 163, 184, 0.28)',

    '--wa-text-primary':    '#e8f0fe',   // 제목 — 따뜻한 화이트
    '--wa-text-secondary':  '#94a3b8',   // 본문
    '--wa-text-muted':      '#52647f',   // 보조
    '--wa-text-disabled':   '#2d3a52',   // 비활성

    '--wa-accent-primary':  '#60a5fa',   // Archive Blue 4
    '--wa-accent-strong':   '#2563eb',
    '--wa-accent-warm':     '#fbbf24',   // Ember 4
    '--wa-accent-teal':     '#2dd4bf',   // 완료 상태
    '--wa-accent-rose':     '#fb7185',   // 드롭 상태

    '--wa-shadow-xs':     '0 1px 2px rgba(0, 0, 0, 0.5)',
    '--wa-shadow-card':   '0 10px 32px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(148, 163, 184, 0.06)',
    '--wa-shadow-poster': '0 18px 44px rgba(0, 0, 0, 0.58), 0 5px 14px rgba(0, 0, 0, 0.34)',
    '--wa-shadow-hero':   '0 32px 80px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(148, 163, 184, 0.09)',
    '--wa-shadow-overlay':'0 28px 92px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(148, 163, 184, 0.12)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(96, 165, 250, 0.25)',

    '--mantine-color-body':           '#05070d',
    '--mantine-color-text':           '#e8f0fe',
    '--mantine-color-dimmed':         '#94a3b8',
    '--mantine-color-default':        '#1a2540',
    '--mantine-color-default-hover':  '#1e2d4a',
    '--mantine-color-default-border': 'rgba(148, 163, 184, 0.10)',

    '--app-bg-shell':        'var(--wa-bg-shell)',
    '--app-bg-base':         'var(--wa-bg-base)',
    '--app-bg-elevated':     'var(--wa-bg-elevated)',
    '--app-surface-default': 'var(--wa-surface-card)',
    '--app-surface-subtle':  'var(--wa-surface-subtle)',
    '--app-surface-card':    'var(--wa-surface-card)',
    '--app-surface-hero':    'var(--wa-surface-hero)',
    '--app-surface-overlay': 'var(--wa-surface-overlay)',
    '--app-border-subtle':   'var(--wa-border-subtle)',
    '--app-border-default':  'var(--wa-border-default)',
    '--app-border-strong':   'var(--wa-border-strong)',
    '--app-text-primary':    'var(--wa-text-primary)',
    '--app-text-secondary':  'var(--wa-text-secondary)',
    '--app-text-muted':      'var(--wa-text-muted)',
    '--app-text-disabled':   'var(--wa-text-disabled)',
    '--app-accent-primary':  'var(--wa-accent-primary)',
    '--app-accent-strong':   'var(--wa-accent-strong)',
    '--app-accent-secondary':'var(--wa-accent-teal)',
    '--app-accent-warm':     'var(--wa-accent-warm)',
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#2dd4bf',
    '--app-state-warning':   '#fbbf24',
    '--app-state-danger':    '#f87171',
    '--app-state-info':      '#60a5fa',
    '--app-shadow-card':     'var(--wa-shadow-card)',
    '--app-shadow-poster':   'var(--wa-shadow-poster)',
    '--app-shadow-overlay':  'var(--wa-shadow-overlay)',
    '--app-shadow-glow':     'var(--wa-shadow-glow)',
  },
});

/* ── Mantine 테마 ─────────────────────────────────────────────────────────── */
export const appTheme = createTheme({
  black: '#0c0e12',
  colors: {
    archive: archiveColors,
    ember: emberColors,
  },
  cursorType: 'pointer',
  defaultGradient: { deg: 135, from: 'archive.5', to: 'archive.7' },
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: appFontFamily,
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',
  fontSizes: {
    xs: 'var(--app-type-meta)',
    sm: 'var(--app-type-caption)',
    md: 'var(--app-type-body)',
    lg: '1.06rem',
    xl: '1.22rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '760',
    sizes: {
      h1: { fontSize: 'var(--app-type-h1)', lineHeight: '1.06' },
      h2: { fontSize: 'var(--app-type-h2)', lineHeight: '1.14' },
      h3: { fontSize: 'var(--app-type-h3)', lineHeight: '1.25' },
      h4: { fontSize: '1rem',               lineHeight: '1.28' },
      h5: { fontSize: '0.92rem',            lineHeight: '1.32' },
      h6: { fontSize: '0.84rem',            lineHeight: '1.36' },
    },
    textWrap: 'balance',
  },
  lineHeights: {
    xs: '1.35', sm: '1.45', md: '1.55', lg: '1.65', xl: '1.75',
  },
  other: {
    captionSize:        'var(--app-type-caption)',
    contentWidth:       1240,
    displaySize:        'var(--app-type-display)',
    eyebrowSize:        'var(--app-type-meta)',
    metaSize:           'var(--app-type-caption)',
    narrowContentWidth: 760,
    shellWidth:         1360,
  },
  primaryColor: 'archive',
  primaryShade: { dark: 4, light: 6 },
  radius: {
    xs: '0.25rem',
    sm: '0.45rem',
    md: '0.65rem',
    lg: '1rem',
    xl: '1.5rem',
  },
  respectReducedMotion: true,
  shadows: {
    xs: 'var(--wa-shadow-xs)',
    sm: 'var(--wa-shadow-card)',
    md: 'var(--wa-shadow-poster)',
    lg: 'var(--wa-shadow-hero)',
    xl: 'var(--wa-shadow-overlay)',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },

  components: {
    ActionIcon: {
      defaultProps: { radius: 'md', variant: 'subtle' },
      styles: {
        root: {
          color:       'var(--app-text-secondary)',
          transition:  'color var(--wa-motion-fast), background var(--wa-motion-fast)',
        },
      },
    },

    Badge: {
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: {
        root: {
          border:        '1px solid transparent',
          fontSize:      'var(--app-type-meta)',
          fontWeight:    700,
          letterSpacing: '0.01em',
          paddingInline: '0.55rem',
          paddingBlock:  '0.18rem',
          textTransform: 'none',
          lineHeight:    '1.5',
        },
      },
    },

    Button: {
      defaultProps: { radius: 'md', size: 'sm' },
      styles: {
        root: {
          fontWeight:    650,
          letterSpacing: '-0.01em',
          paddingInline: '1rem',
          transition: [
            'transform var(--wa-motion-fast)',
            'background var(--wa-motion-fast)',
            'border-color var(--wa-motion-fast)',
            'color var(--wa-motion-fast)',
            'box-shadow var(--wa-motion-fast)',
          ].join(', '),
        },
      },
    },

    Input: {
      styles: {
        input: {
          backgroundColor: 'var(--app-bg-elevated)',
          borderColor:     'var(--app-border-default)',
          color:           'var(--app-text-primary)',
          transition:      'border-color var(--wa-motion-fast), box-shadow var(--wa-motion-fast)',
        },
      },
    },

    InputWrapper: {
      styles: {
        description: {
          color:     'var(--app-text-muted)',
          fontSize:  'var(--app-type-caption)',
        },
        label: {
          color:         'var(--app-text-secondary)',
          fontWeight:    650,
          fontSize:      'var(--app-type-caption)',
          letterSpacing: '0.01em',
          marginBottom:  '0.35rem',
        },
      },
    },

    Menu: {
      defaultProps: { radius: 'lg', shadow: 'xl', withArrow: false },
      styles: {
        dropdown: {
          backgroundColor: 'var(--app-surface-overlay)',
          borderColor:     'var(--app-border-default)',
          border:          '1px solid var(--app-border-default)',
          backdropFilter:  'blur(20px) saturate(1.4)',
          padding:         '0.35rem',
        },
        item: {
          borderRadius: 'var(--mantine-radius-md)',
          color:        'var(--app-text-secondary)',
          fontSize:     'var(--app-type-body)',
          padding:      '0.5rem 0.75rem',
          transition:   'background var(--wa-motion-fast), color var(--wa-motion-fast)',
        },
        label: {
          color:         'var(--app-text-muted)',
          fontSize:      'var(--app-type-meta)',
          fontWeight:    700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding:       '0.5rem 0.75rem 0.25rem',
        },
        divider: {
          borderColor: 'var(--app-border-subtle)',
          marginBlock: '0.3rem',
        },
      },
    },

    Modal: {
      defaultProps: {
        radius: 'xl',
        overlayProps: { blur: 6, backgroundOpacity: 0.55 },
      },
      styles: {
        content: {
          backgroundColor: 'var(--app-surface-overlay)',
          border:          '1px solid var(--app-border-default)',
        },
        header: {
          backgroundColor: 'transparent',
          borderBottom:    '1px solid var(--app-border-subtle)',
          paddingBottom:   '0.75rem',
        },
        title: {
          fontWeight: 760,
          fontSize:   'var(--app-type-h3)',
          color:      'var(--app-text-primary)',
        },
      },
    },

    NativeSelect:  { defaultProps: { radius: 'md', size: 'md' } },
    NumberInput:   { defaultProps: { radius: 'md', size: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md', size: 'md' } },

    Paper: {
      defaultProps: { radius: 'lg', withBorder: true },
      styles: {
        root: {
          backgroundColor: 'var(--app-surface-card)',
          borderColor:     'var(--app-border-subtle)',
          boxShadow:       'none',
        },
      },
    },

    SegmentedControl: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          backgroundColor: 'var(--app-bg-elevated)',
          border:          '1px solid var(--app-border-subtle)',
          padding:         '3px',
          gap:             '2px',
        },
        indicator: {
          backgroundColor: 'var(--app-surface-card)',
          boxShadow:       'var(--wa-shadow-xs)',
          borderRadius:    'var(--mantine-radius-sm)',
        },
        label: {
          fontSize:    'var(--app-type-caption)',
          fontWeight:  650,
          color:       'var(--app-text-secondary)',
          transition:  'color var(--wa-motion-fast)',
          paddingBlock: '0.3rem',
        },
      },
    },

    Select:   { defaultProps: { radius: 'md', size: 'md' } },
    TextInput: { defaultProps: { radius: 'md', size: 'md' } },

    Textarea: {
      defaultProps: { autosize: true, minRows: 3, radius: 'md', size: 'md' },
    },

    Title: {
      styles: {
        root: {
          color:               'var(--app-text-primary)',
          letterSpacing:       '-0.025em',
          fontFeatureSettings: '"ss01", "cv01"',
        },
      },
    },

    Tooltip: {
      defaultProps: { radius: 'md', withArrow: true },
      styles: {
        tooltip: {
          backgroundColor: 'var(--app-surface-overlay)',
          border:          '1px solid var(--app-border-default)',
          color:           'var(--app-text-primary)',
          fontSize:        'var(--app-type-caption)',
          fontWeight:      600,
          backdropFilter:  'blur(8px)',
        },
      },
    },
  },
});
