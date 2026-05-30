/**
 * Work Archive — Mantine Theme v4.0.0
 * "Archive Cinema" — Netflix · Letterboxd · Ridi 수준의 콘텐츠 플랫폼 다크 UI
 *
 * 설계 원칙
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. 콘텐츠 우선: 포스터·커버가 주인공, UI는 프레임
 * 2. 따뜻한 다크: 차가운 네이비 → 따뜻한 흑갈 (영화관·고급 서점 야경)
 * 3. 골드 정체성: 기술 블루 → 에디토리얼 골드 (책 표지, 별점, 품질 감각)
 * 4. 강한 위계: 제목과 본문의 명확한 무게 대비
 * 5. 모션: spring 곡선 — 빠른 응답, 자연스러운 감속
 */

import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

/* ── 폰트 ─────────────────────────────────────────────────────────────────── */
const appFontFamily =
  '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Vellum Index — 에디토리얼 디스플레이 세리프(기념비적 제목)와 본문 세리프 악센트.
// 라틴 글리프는 Gloock/Lora, 한글은 Pretendard로 자연스럽게 폴백된다.
const appDisplayFamily =
  `Gloock, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", Georgia, serif`;
const appSerifFamily =
  `Lora, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", Georgia, serif`;

/* ── Archive Gold 팔레트 — 에디토리얼 골드, 별점·CTA 강조 ───────────────── */
const archiveColors: MantineColorsTuple = [
  '#fefbf0', // 0 — 크림 배경
  '#fef3d0', // 1 — 연한 앰버
  '#fde68a', // 2 — 밝은 골드
  '#fcd34d', // 3 — 라이트 골드
  '#f5c842', // 4 — 메인 골드 (호버)
  '#d4a843', // 5 — Primary 골드 (다크 모드)
  '#b8872a', // 6 — Primary 골드 (라이트 모드)
  '#9a6d1e', // 7 — 깊은 골드
  '#7c5616', // 8 — 진한 골드
  '#5e3f0d', // 9 — 최심 골드
];

/* ── Archive Ink 팔레트 — 보조 블루, 싱크·상태 표시 ───────────────────────── */
const inkColors: MantineColorsTuple = [
  '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#6fb3f7',
  '#5b9cf6', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a',
];

/* ── Color Scheme Manager ─────────────────────────────────────────────────── */
export const appColorSchemeManager = localStorageColorSchemeManager({
  key: 'work-archive.ui.color-scheme',
});

/* ── CSS 변수 리졸버 ─────────────────────────────────────────────────────── */
export const appCssVariablesResolver: CSSVariablesResolver = (_theme) => ({
  variables: {
    /* ── 모션 시스템 ── */
    '--wa-motion-instant':  '80ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-fast':     '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-normal':   '240ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-slow':     '380ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-enter':    '300ms cubic-bezier(0.16, 1, 0.3, 1)',
    '--wa-motion-exit':     '180ms cubic-bezier(0.4, 0, 1, 1)',
    '--wa-motion-spring':   '300ms cubic-bezier(0.16, 1, 0.3, 1)',

    /* ── 타이포그래피 스케일 ── */
    '--wa-type-display': 'clamp(2.6rem, 7.5vw, 5.6rem)',
    '--wa-type-h1':      'clamp(2rem, 4.8vw, 3.8rem)',
    '--wa-type-h2':      'clamp(1.4rem, 3vw, 2.1rem)',
    '--wa-type-h3':      '1.1rem',
    '--wa-type-body':    '1rem',
    '--wa-type-caption': '0.85rem',
    '--wa-type-meta':    '0.75rem',
    '--app-type-display': 'var(--wa-type-display)',
    '--app-type-h1':      'var(--wa-type-h1)',
    '--app-type-h2':      'var(--wa-type-h2)',
    '--app-type-h3':      'var(--wa-type-h3)',
    '--app-type-body':    'var(--wa-type-body)',
    '--app-type-caption': 'var(--wa-type-caption)',
    '--app-type-meta':    'var(--wa-type-meta)',

    /* ── 폰트 패밀리 — Vellum Index ── */
    '--app-font-display': appDisplayFamily,
    '--app-font-serif':   appSerifFamily,
    '--app-font-mono':    '"JetBrains Mono", "GeistMono", ui-monospace, monospace',

    /* ── 여백 스케일 ── */
    '--app-space-page':    'clamp(1.25rem, 3vw, 2.5rem)',
    '--app-space-section': 'clamp(2.5rem, 5.5vw, 4.5rem)',
    '--app-space-card':    'clamp(1rem, 2.4vw, 1.5rem)',
    '--app-space-control': '0.75rem',
  },

  /* ── 다크 모드 — 따뜻한 시네마 다크 ── */
  dark: {
    /* 배경 — 따뜻한 흑갈, 차가운 네이비 제거 */
    '--wa-bg-shell':        '#0c0b0a',
    '--wa-bg-base':         '#111110',
    '--wa-bg-elevated':     '#181716',
    '--wa-surface-subtle':  '#1e1d1c',
    '--wa-surface-card':    '#242220',
    '--wa-surface-hero':    '#1a1917',
    '--wa-surface-overlay': '#2a2826',

    /* 테두리 — 따뜻한 톤 */
    '--wa-border-subtle':   'rgba(255, 235, 200, 0.06)',
    '--wa-border-default':  'rgba(255, 235, 200, 0.11)',
    '--wa-border-strong':   'rgba(255, 235, 200, 0.20)',

    /* 텍스트 — 따뜻한 화이트 */
    '--wa-text-primary':    '#f5f0e8',
    '--wa-text-secondary':  '#a09080',
    '--wa-text-muted':      '#5c5048',
    '--wa-text-disabled':   '#302a24',

    /* 악센트 — 골드 주도, 블루 보조 */
    '--wa-accent-primary':  '#d4a843',
    '--wa-accent-strong':   '#f5c842',
    '--wa-accent-ink':      '#5b9cf6',
    '--wa-accent-teal':     '#2dd4bf',
    '--wa-accent-rose':     '#fb7185',

    /* 그림자 — 따뜻한 톤 */
    '--wa-shadow-xs':     '0 1px 2px rgba(0, 0, 0, 0.55)',
    '--wa-shadow-card':   '0 4px 16px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 235, 200, 0.05)',
    '--wa-shadow-poster': '0 12px 36px rgba(0, 0, 0, 0.52), 0 3px 8px rgba(0, 0, 0, 0.30)',
    '--wa-shadow-hero':   '0 20px 56px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(255, 235, 200, 0.07)',
    '--wa-shadow-overlay':'0 24px 72px rgba(0, 0, 0, 0.64), 0 0 0 1px rgba(255, 235, 200, 0.09)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(212, 168, 67, 0.22)',

    '--mantine-color-body':           '#0c0b0a',
    '--mantine-color-text':           '#f5f0e8',
    '--mantine-color-dimmed':         '#a09080',
    '--mantine-color-default':        '#242220',
    '--mantine-color-default-hover':  '#2a2826',
    '--mantine-color-default-border': 'rgba(255, 235, 200, 0.09)',

    /* app alias */
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
    '--app-accent-secondary':'var(--wa-accent-ink)',
    '--app-accent-warm':     'var(--wa-accent-strong)',
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#2dd4bf',
    '--app-state-warning':   '#f5c842',
    '--app-state-danger':    '#f87171',
    '--app-state-info':      '#5b9cf6',
    '--app-shadow-card':     'var(--wa-shadow-card)',
    '--app-shadow-poster':   'var(--wa-shadow-poster)',
    '--app-shadow-overlay':  'var(--wa-shadow-overlay)',
    '--app-shadow-glow':     'var(--wa-shadow-glow)',
  },

  /* ── 라이트 모드 — 따뜻한 크림 */
  light: {
    '--wa-bg-shell':        '#faf7f2',
    '--wa-bg-base':         '#f2ede6',
    '--wa-bg-elevated':     '#ece5db',
    '--wa-surface-subtle':  '#f5f0e8',
    '--wa-surface-card':    '#ffffff',
    '--wa-surface-hero':    '#f8f4ef',
    '--wa-surface-overlay': '#ffffff',

    '--wa-border-subtle':   'rgba(60, 40, 20, 0.07)',
    '--wa-border-default':  'rgba(60, 40, 20, 0.12)',
    '--wa-border-strong':   'rgba(60, 40, 20, 0.22)',

    '--wa-text-primary':    '#1c1512',
    '--wa-text-secondary':  '#4a3c32',
    '--wa-text-muted':      '#8c7a6e',
    '--wa-text-disabled':   '#c9bdb5',

    '--wa-accent-primary':  '#b8872a',
    '--wa-accent-strong':   '#9a6d1e',
    '--wa-accent-ink':      '#2563eb',
    '--wa-accent-teal':     '#0d9488',
    '--wa-accent-rose':     '#e11d48',

    '--wa-shadow-xs':     '0 1px 2px rgba(60, 40, 20, 0.07)',
    '--wa-shadow-card':   '0 1px 6px rgba(60, 40, 20, 0.09), 0 0 0 1px rgba(60, 40, 20, 0.05)',
    '--wa-shadow-poster': '0 4px 18px rgba(60, 40, 20, 0.14), 0 1px 4px rgba(60, 40, 20, 0.07)',
    '--wa-shadow-hero':   '0 8px 36px rgba(60, 40, 20, 0.16), 0 2px 8px rgba(60, 40, 20, 0.07)',
    '--wa-shadow-overlay':'0 16px 52px rgba(60, 40, 20, 0.18), 0 0 0 1px rgba(60, 40, 20, 0.07)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(184, 135, 42, 0.22)',

    '--mantine-color-body':           '#faf7f2',
    '--mantine-color-text':           '#1c1512',
    '--mantine-color-dimmed':         '#8c7a6e',
    '--mantine-color-default':        '#ffffff',
    '--mantine-color-default-hover':  '#f5f0e8',
    '--mantine-color-default-border': 'rgba(60, 40, 20, 0.12)',

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
    '--app-accent-secondary':'var(--wa-accent-ink)',
    '--app-accent-warm':     'var(--wa-accent-strong)',
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#0f766e',
    '--app-state-warning':   '#b8872a',
    '--app-state-danger':    '#dc2626',
    '--app-state-info':      '#2563eb',
    '--app-shadow-card':     'var(--wa-shadow-card)',
    '--app-shadow-poster':   'var(--wa-shadow-poster)',
    '--app-shadow-overlay':  'var(--wa-shadow-overlay)',
    '--app-shadow-glow':     'var(--wa-shadow-glow)',
  },
});

/* ── Mantine 테마 ─────────────────────────────────────────────────────────── */
export const appTheme = createTheme({
  black: '#0c0b0a',
  colors: {
    archive: archiveColors,
    ink: inkColors,
  },
  cursorType: 'pointer',
  defaultGradient: { deg: 135, from: 'archive.4', to: 'archive.6' },
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: appFontFamily,
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", monospace',
  fontSizes: {
    xs: 'var(--app-type-meta)',
    sm: 'var(--app-type-caption)',
    md: 'var(--app-type-body)',
    lg: '1.08rem',
    xl: '1.25rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '780',
    sizes: {
      h1: { fontSize: 'var(--app-type-h1)', lineHeight: '1.05' },
      h2: { fontSize: 'var(--app-type-h2)', lineHeight: '1.12' },
      h3: { fontSize: 'var(--app-type-h3)', lineHeight: '1.22' },
      h4: { fontSize: '1rem',               lineHeight: '1.28' },
      h5: { fontSize: '0.9rem',             lineHeight: '1.32' },
      h6: { fontSize: '0.82rem',            lineHeight: '1.38' },
    },
    textWrap: 'balance',
  },
  lineHeights: {
    xs: '1.35', sm: '1.45', md: '1.58', lg: '1.68', xl: '1.78',
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
  primaryShade: { dark: 5, light: 6 },
  radius: {
    xs: '0.25rem',
    sm: '0.45rem',
    md: '0.7rem',
    lg: '1.1rem',
    xl: '1.6rem',
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
          color:      'var(--app-text-secondary)',
          transition: 'color var(--wa-motion-fast), background var(--wa-motion-fast)',
        },
      },
    },

    Badge: {
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: {
        root: {
          border:        '1px solid transparent',
          fontSize:      'var(--app-type-meta)',
          fontWeight:    750,
          letterSpacing: '0.02em',
          paddingInline: '0.5rem',
          paddingBlock:  '0.16rem',
          textTransform: 'none',
          lineHeight:    '1.5',
        },
      },
    },

    Button: {
      defaultProps: { radius: 'md', size: 'sm' },
      styles: {
        root: {
          fontWeight:    680,
          letterSpacing: '-0.008em',
          paddingInline: '1.1rem',
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
          color:    'var(--app-text-muted)',
          fontSize: 'var(--app-type-caption)',
        },
        label: {
          color:         'var(--app-text-secondary)',
          fontWeight:    680,
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
          backdropFilter:  'blur(24px) saturate(1.3)',
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
          fontWeight:    750,
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
        overlayProps: { blur: 8, backgroundOpacity: 0.65 },
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
          fontWeight: 780,
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
          fontSize:     'var(--app-type-caption)',
          fontWeight:   680,
          color:        'var(--app-text-secondary)',
          transition:   'color var(--wa-motion-fast)',
          paddingBlock: '0.3rem',
        },
      },
    },

    Select:    { defaultProps: { radius: 'md', size: 'md' } },
    TextInput: { defaultProps: { radius: 'md', size: 'md' } },

    Textarea: {
      defaultProps: { autosize: true, minRows: 3, radius: 'md', size: 'md' },
    },

    Title: {
      styles: {
        root: {
          color:               'var(--app-text-primary)',
          letterSpacing:       '-0.03em',
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
          fontWeight:      620,
          backdropFilter:  'blur(10px)',
        },
      },
    },
  },
});
