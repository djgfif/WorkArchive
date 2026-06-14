import type { AppLocale } from '../locales';
import type { AppTranslationResource } from '../types';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zhCN } from './zh-CN';

export type AppResourceBundle = {
  translation: AppTranslationResource;
};

export const APP_I18N_RESOURCES = {
  en: {
    translation: en,
  },
  ja: {
    translation: ja,
  },
  ko: {
    translation: ko,
  },
  'zh-CN': {
    translation: zhCN,
  },
} as const satisfies Partial<Record<AppLocale, AppResourceBundle>>;

export const AVAILABLE_RESOURCE_LOCALES = Object.keys(
  APP_I18N_RESOURCES,
) as AppLocale[];
