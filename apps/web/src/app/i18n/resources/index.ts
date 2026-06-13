import type { AppLocale } from '../locales';
import { ko } from './ko';

export type AppResourceBundle = {
  translation: typeof ko;
};

export const APP_I18N_RESOURCES = {
  ko: {
    translation: ko,
  },
} as const satisfies Partial<Record<AppLocale, AppResourceBundle>>;

export const AVAILABLE_RESOURCE_LOCALES = Object.keys(
  APP_I18N_RESOURCES,
) as AppLocale[];
