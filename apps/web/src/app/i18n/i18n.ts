import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  normalizeAppLocale,
  readStoredAppLocale,
  writeStoredAppLocale,
  type AppLocale,
} from './locales';
import { APP_I18N_RESOURCES, AVAILABLE_RESOURCE_LOCALES } from './resources';

export const appI18n = i18n.createInstance();

appI18n.use(initReactI18next);

void appI18n.init({
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
  lng: readStoredAppLocale(),
  resources: APP_I18N_RESOURCES,
  supportedLngs: AVAILABLE_RESOURCE_LOCALES,
});

export function getCurrentAppLocale(): AppLocale {
  return (appI18n.resolvedLanguage ??
    appI18n.language ??
    DEFAULT_LOCALE) as AppLocale;
}

export async function changeAppLocale(locale: AppLocale): Promise<void> {
  const enabledLocale = normalizeAppLocale(locale);

  writeStoredAppLocale(enabledLocale);
  await appI18n.changeLanguage(enabledLocale);
}
