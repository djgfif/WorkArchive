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

  it('keeps the planned locale type surface while enabling only Korean', () => {
    expect(SUPPORTED_LOCALES).toEqual(['ko', 'en', 'ja', 'zh-CN']);
    expect(ENABLED_LOCALES).toEqual(['ko']);
    expect(DEFAULT_LOCALE).toBe('ko');
  });

  it('falls back to Korean for missing, unknown, or disabled stored locales', () => {
    expect(normalizeAppLocale(null)).toBe('ko');
    expect(normalizeAppLocale('fr')).toBe('ko');
    expect(normalizeAppLocale('en')).toBe('ko');

    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, 'ja');
    expect(readStoredAppLocale()).toBe('ko');
  });

  it('persists the enabled locale in the public localStorage key', () => {
    writeStoredAppLocale('ko');

    expect(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)).toBe('ko');
    expect(readStoredAppLocale()).toBe('ko');
  });

  it('keeps resource bundles available for every enabled locale', () => {
    expect(AVAILABLE_RESOURCE_LOCALES).toEqual(['ko']);
    expect(ENABLED_LOCALES.every((locale) => locale in APP_I18N_RESOURCES)).toBe(
      true,
    );
  });
});
