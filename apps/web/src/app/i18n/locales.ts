export const DEFAULT_LOCALE = 'ko';

export const SUPPORTED_LOCALES = ['ko', 'en', 'ja', 'zh-CN'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const ENABLED_LOCALES = [
  'ko',
  'en',
  'ja',
  'zh-CN',
] as const satisfies readonly AppLocale[];

export const APP_LOCALE_STORAGE_KEY = 'work-archive.ui.locale';

export interface AppLocaleOption {
  label: string;
  locale: AppLocale;
  nativeLabel: string;
}

export const APP_LOCALE_OPTIONS: Record<AppLocale, AppLocaleOption> = {
  ko: {
    label: 'Korean',
    locale: 'ko',
    nativeLabel: '한국어',
  },
  en: {
    label: 'English',
    locale: 'en',
    nativeLabel: 'English',
  },
  ja: {
    label: 'Japanese',
    locale: 'ja',
    nativeLabel: '日本語',
  },
  'zh-CN': {
    label: 'Chinese (Simplified)',
    locale: 'zh-CN',
    nativeLabel: '简体中文',
  },
};

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);
const enabledLocaleSet = new Set<string>(ENABLED_LOCALES);

export function isSupportedAppLocale(value: string): value is AppLocale {
  return supportedLocaleSet.has(value);
}

export function isEnabledAppLocale(value: string): value is AppLocale {
  return enabledLocaleSet.has(value);
}

export function normalizeAppLocale(
  value: string | null | undefined,
): AppLocale {
  if (value && isSupportedAppLocale(value) && isEnabledAppLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}

export function readStoredAppLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  try {
    return normalizeAppLocale(
      window.localStorage.getItem(APP_LOCALE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeStoredAppLocale(locale: AppLocale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale persistence is a convenience; do not block app rendering.
  }
}
