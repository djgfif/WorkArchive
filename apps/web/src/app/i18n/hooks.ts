import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { appI18n, changeAppLocale } from './i18n';
import { APP_LOCALE_OPTIONS, ENABLED_LOCALES, type AppLocale } from './locales';

export function useAppTranslation() {
  return useTranslation();
}

export function useAppLocale() {
  const { i18n } = useAppTranslation();
  const currentLocale = (i18n.resolvedLanguage ?? i18n.language) as AppLocale;
  const setLocale = useCallback(
    (locale: AppLocale) => changeAppLocale(locale),
    [],
  );
  const enabledLocales = useMemo(
    () => ENABLED_LOCALES.map((locale) => APP_LOCALE_OPTIONS[locale]),
    [],
  );

  return {
    enabledLocales,
    i18n: appI18n,
    locale: currentLocale,
    setLocale,
  };
}
