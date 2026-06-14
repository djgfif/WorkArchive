import { describe, expect, it, afterEach } from 'vitest';

import {
  APP_LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  SUPPORTED_LOCALES,
  normalizeAppLocale,
  readStoredAppLocale,
  writeStoredAppLocale,
} from './locales';
import { APP_I18N_RESOURCES, AVAILABLE_RESOURCE_LOCALES } from './resources';

describe('app locale contract', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps the planned locale type surface with reviewed locales enabled', () => {
    expect(SUPPORTED_LOCALES).toEqual(['ko', 'en', 'ja', 'zh-CN']);
    expect(ENABLED_LOCALES).toEqual(['ko', 'en', 'ja', 'zh-CN']);
    expect(DEFAULT_LOCALE).toBe('ko');
  });

  it('falls back to Korean for missing or unknown stored locales', () => {
    expect(normalizeAppLocale(null)).toBe('ko');
    expect(normalizeAppLocale('fr')).toBe('ko');
    expect(normalizeAppLocale('en')).toBe('en');

    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'ja');
    expect(readStoredAppLocale()).toBe('ja');
  });

  it('persists the enabled locale in the public localStorage key', () => {
    writeStoredAppLocale('zh-CN');

    expect(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)).toBe('zh-CN');
    expect(readStoredAppLocale()).toBe('zh-CN');
  });

  it('keeps resource bundles available for every enabled locale', () => {
    expect(AVAILABLE_RESOURCE_LOCALES).toEqual(['en', 'ja', 'ko', 'zh-CN']);
    expect(ENABLED_LOCALES.every((locale) => locale in APP_I18N_RESOURCES)).toBe(
      true,
    );
  });
});
