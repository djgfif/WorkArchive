/**
 * Work Archive — Mantine Theme v6.0.0
 * "Studio" — 대중적 모던 SaaS UI: 깔끔하고 중립적이며 친숙한 다크/라이트 인터페이스
 *
 * 설계 원칙 (v5 "Vellum Index" 에디토리얼/빈티지 톤에서 전환)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. 콘텐츠 우선: 표지·기록이 주인공, UI는 중립 표면으로 물러난다
 * 2. 중립 다크/라이트: 따뜻한 흑갈 → 중립 슬레이트(차분한 회색), 친숙한 제품 톤
 * 3. 단일 브랜드 액센트: 앤틱 골드 → 모던 인디고/바이올렛 — 활성·강조에만 절제해 사용
 * 4. 명료한 위계: 산세리프(Pretendard) 일관 사용, 절제된 디스플레이 스케일, 또렷한 굵기 대비
 * 5. 깔끔한 깊이: border + surface 명도 + 절제된 그림자(오버레이·호버)로 깊이를 만든다
 * 6. 모션: spring 곡선 — 빠른 응답, 자연스러운 감속
 *
 * 토큰 이름(--wa-*, --app-*)과 색상 키(archive)는 v5와 호환 유지 — 값만 교체된다.
 */

import {
  createTheme,
  localStorageColorSchemeManager,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

/* ── 폰트 — Pretendard 산세리프 단일 패밀리 ──────────────────────────────────
   v5의 에디토리얼 세리프(Gloock/Lora/Noto Serif KR)를 제거하고, 본문·디스플레이를
   모두 Pretendard 산세리프로 통일한다. 위계는 폰트가 아니라 크기·굵기·여백으로 만든다. */
const appFontFamily =
  '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// 디스플레이·세리프 토큰도 동일 산세리프로 매핑해, 토큰을 참조하는 기존 CSS가
// 자동으로 모던 산세리프로 렌더되게 한다.
const appDisplayFamily = appFontFamily;
const appSerifFamily = appFontFamily;

/* ── Brand 팔레트 — 모던 인디고/바이올렛 (활성·CTA·강조) ─────────────────────
   Mantine 색상 키는 호환을 위해 'archive'를 유지하되 값은 인디고로 교체한다. */
const brandColors: MantineColorsTuple = [
  '#eef2ff', // 0
  '#e0e7ff', // 1
  '#c7d2fe', // 2
  '#a5b4fc', // 3
  '#818cf8', // 4
  '#6366f1', // 5 — Primary (다크 모드)
  '#4f46e5', // 6 — Primary (라이트 모드)
  '#4338ca', // 7
  '#3730a3', // 8
  '#312e81', // 9
];

/* ── Ink 팔레트 — 보조 스카이/시안, 싱크·정보 상태 표시 ───────────────────── */
const inkColors: MantineColorsTuple = [
  '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
  '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
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

    /* ── 타이포그래피 스케일 — 절제된 모던 SaaS 스케일 ── */
    '--wa-type-display': 'clamp(2.2rem, 5vw, 3.6rem)',
    '--wa-type-h1':      'clamp(1.7rem, 3.4vw, 2.6rem)',
    '--wa-type-h2':      'clamp(1.3rem, 2.4vw, 1.75rem)',
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

    /* ── 폰트 패밀리 — Studio (산세리프 단일) ── */
    '--app-font-display': appDisplayFamily,
    '--app-font-serif':   appSerifFamily,
    '--app-font-mono':    '"JetBrains Mono", "GeistMono", ui-monospace, monospace',
    // 수치 전용 — 숫자는 모노(로그북 정렬), 한글 단위("개" 등)는 Pretendard로 폴백해 충돌 방지
    '--app-font-figure':  '"JetBrains Mono", "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", ui-monospace, monospace',

    /* ── 여백 스케일 ── */
    '--app-space-page':    'clamp(1.25rem, 3vw, 2.5rem)',
    '--app-space-section': 'clamp(2.5rem, 5.5vw, 4.5rem)',
    '--app-space-card':    'clamp(1rem, 2.4vw, 1.5rem)',
    '--app-space-control': '0.75rem',
  },

  /* ── 다크 모드 — 중립 슬레이트 다크 ── */
  dark: {
    /* 배경 — 중립 슬레이트(차가운 네이비·따뜻한 흑갈 모두 배제) */
    '--wa-bg-shell':        '#0a0a0c',
    '--wa-bg-base':         '#0e0e11',
    '--wa-bg-elevated':     '#16161a',
    '--wa-surface-subtle':  '#1a1a1f',
    '--wa-surface-card':    '#1c1c22',
    '--wa-surface-hero':    '#161619',
    '--wa-surface-overlay': '#212128',

    /* 테두리 — 중립 화이트 알파 */
    '--wa-border-subtle':   'rgba(255, 255, 255, 0.06)',
    '--wa-border-default':  'rgba(255, 255, 255, 0.10)',
    '--wa-border-strong':   'rgba(255, 255, 255, 0.17)',

    /* 텍스트 — 중립 화이트 */
    '--wa-text-primary':    '#f4f4f6',
    '--wa-text-secondary':  '#a7a7b4', /* 셸 대비 ≈8:1 */
    '--wa-text-muted':      '#8a8a99', /* 셸 대비 ≈5.6:1 (AA) */
    '--wa-text-disabled':   '#3a3a44',

    /* 악센트 — 인디고 주도, 스카이 보조 (절제) */
    '--wa-accent-primary':  '#6366f1',
    '--wa-accent-strong':   '#818cf8',
    '--wa-accent-soft':     'rgba(99, 102, 241, 0.16)',
    '--wa-accent-ink':      '#38bdf8',
    '--wa-accent-teal':     '#2dd4bf',
    '--wa-accent-rose':     '#fb7185',

    /* 그림자 — 절제. depth 는 border + surface 명도로, 그림자는 오버레이·호버에 */
    '--wa-shadow-xs':     '0 1px 2px rgba(0, 0, 0, 0.50)',
    '--wa-shadow-card':   '0 1px 2px rgba(0, 0, 0, 0.30)',
    '--wa-shadow-poster': '0 10px 30px rgba(0, 0, 0, 0.45)',
    '--wa-shadow-hero':   '0 12px 34px rgba(0, 0, 0, 0.40)',
    '--wa-shadow-overlay':'0 18px 50px rgba(0, 0, 0, 0.55)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(99, 102, 241, 0.28)',

    '--mantine-color-body':           '#0a0a0c',
    '--mantine-color-text':           '#f4f4f6',
    '--mantine-color-dimmed':         '#a7a7b4',
    '--mantine-color-default':        '#1c1c22',
    '--mantine-color-default-hover':  '#212128',
    '--mantine-color-default-border': 'rgba(255, 255, 255, 0.09)',

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
    '--app-accent-soft':     'var(--wa-accent-soft)',
    '--app-accent-secondary':'var(--wa-accent-ink)',
    '--app-accent-warm':     '#fbbf24', /* 별점 전용 앰버 — 보편적 평점 골드 (다크) */
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#34d399',
    '--app-state-warning':   '#fbbf24',
    '--app-state-danger':    '#f87171',
    '--app-state-info':      '#60a5fa',
    '--app-shadow-card':     'var(--wa-shadow-card)',
    '--app-shadow-poster':   'var(--wa-shadow-poster)',
    '--app-shadow-overlay':  'var(--wa-shadow-overlay)',
    '--app-shadow-glow':     'var(--wa-shadow-glow)',
  },

  /* ── 라이트 모드 — 깔끔한 중립 화이트/그레이 */
  light: {
    '--wa-bg-shell':        '#fbfbfd',
    '--wa-bg-base':         '#f4f4f7',
    '--wa-bg-elevated':     '#ffffff',
    '--wa-surface-subtle':  '#f5f5f8',
    '--wa-surface-card':    '#ffffff',
    '--wa-surface-hero':    '#fafafb',
    '--wa-surface-overlay': '#ffffff',

    '--wa-border-subtle':   'rgba(15, 18, 35, 0.06)',
    '--wa-border-default':  'rgba(15, 18, 35, 0.10)',
    '--wa-border-strong':   'rgba(15, 18, 35, 0.16)',

    '--wa-text-primary':    '#17171c',
    '--wa-text-secondary':  '#52525f',
    '--wa-text-muted':      '#70707e', /* 셸 대비 ≈4.9:1 (AA) */
    '--wa-text-disabled':   '#c2c2cc',

    '--wa-accent-primary':  '#4f46e5',
    '--wa-accent-strong':   '#4338ca',
    '--wa-accent-soft':     'rgba(79, 70, 229, 0.10)',
    '--wa-accent-ink':      '#0284c7',
    '--wa-accent-teal':     '#0d9488',
    '--wa-accent-rose':     '#e11d48',

    '--wa-shadow-xs':     '0 1px 2px rgba(15, 18, 35, 0.05)',
    '--wa-shadow-card':   '0 1px 2px rgba(15, 18, 35, 0.06)',
    '--wa-shadow-poster': '0 8px 24px rgba(15, 18, 35, 0.10)',
    '--wa-shadow-hero':   '0 10px 30px rgba(15, 18, 35, 0.10)',
    '--wa-shadow-overlay':'0 16px 44px rgba(15, 18, 35, 0.14)',
    '--wa-shadow-glow':   '0 0 0 3px rgba(79, 70, 229, 0.18)',

    '--mantine-color-body':           '#fbfbfd',
    '--mantine-color-text':           '#17171c',
    '--mantine-color-dimmed':         '#70707e',
    '--mantine-color-default':        '#ffffff',
    '--mantine-color-default-hover':  '#f5f5f8',
    '--mantine-color-default-border': 'rgba(15, 18, 35, 0.12)',

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
    '--app-accent-soft':     'var(--wa-accent-soft)',
    '--app-accent-secondary':'var(--wa-accent-ink)',
    '--app-accent-warm':     '#b45309', /* 별점 전용 앰버 — 화이트 대비 ≈4.3:1 (AA), 보편적 평점 골드 (라이트) */
    '--app-accent-teal':     'var(--wa-accent-teal)',
    '--app-accent-rose':     'var(--wa-accent-rose)',
    '--app-state-success':   '#059669',
    '--app-state-warning':   '#b45309',
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
  // 인디고 채움(5/6) 위에는 흰 텍스트가 오도록 autoContrast 로 명도 기반 선택.
  autoContrast: true,
  black: '#0a0a0c',
  colors: {
    archive: brandColors,
    ink: inkColors,
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
    lg: '1.08rem',
    xl: '1.25rem',
  },
  headings: {
    fontFamily: appFontFamily,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: 'var(--app-type-h1)', lineHeight: '1.1' },
      h2: { fontSize: 'var(--app-type-h2)', lineHeight: '1.18' },
      h3: { fontSize: 'var(--app-type-h3)', lineHeight: '1.28' },
      h4: { fontSize: '1rem',               lineHeight: '1.32' },
      h5: { fontSize: '0.9rem',             lineHeight: '1.4' },
      h6: { fontSize: '0.82rem',            lineHeight: '1.45' },
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
    xs: '0.25rem',  /* 4px */
    sm: '0.375rem', /* 6px */
    md: '0.5rem',   /* 8px  — 기본(버튼·입력) */
    lg: '0.75rem',  /* 12px — 카드 */
    xl: '1rem',     /* 16px — 모달 */
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
          transition:
            'color var(--wa-motion-fast), background var(--wa-motion-fast), transform var(--wa-motion-fast)',
        },
      },
    },

    Badge: {
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: {
        root: {
          border:        '1px solid transparent',
          fontSize:      'var(--app-type-meta)',
          fontWeight:    650,
          letterSpacing: '0.01em',
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
          fontWeight:    600,
          letterSpacing: '-0.006em',
          paddingInline: '1.05rem',
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
          backgroundColor: 'var(--app-surface-subtle)',
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
          fontWeight:    600,
          fontSize:      'var(--app-type-caption)',
          letterSpacing: '0.005em',
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
          boxShadow:       'var(--app-shadow-overlay)',
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
          fontWeight:    650,
          letterSpacing: '0.06em',
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
        overlayProps: { blur: 2, backgroundOpacity: 0.55 },
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
          fontWeight: 700,
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
          backgroundColor: 'var(--app-surface-subtle)',
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
          fontWeight:   600,
          color:        'var(--app-text-secondary)',
          transition:   'color var(--wa-motion-fast)',
          paddingBlock: '0.3rem',
        },
      },
    },

    Select:    { defaultProps: { radius: 'md', size: 'md' } },
    TextInput: { defaultProps: { radius: 'md', size: 'md' } },

    Textarea: {
      // maxRows 상한으로 긴 입력 시 텍스트영역이 무한 확장해 저장 CTA를 밀어내지 않게 한다(상한 후 내부 스크롤).
      defaultProps: { autosize: true, minRows: 3, maxRows: 12, radius: 'md', size: 'md' },
    },

    Title: {
      styles: {
        root: {
          color:         'var(--app-text-primary)',
          letterSpacing: '-0.02em',
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
        },
      },
    },
  },
});
