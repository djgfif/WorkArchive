import { describe, expect, it, afterEach } from 'vitest';

import {
  APP_LOCALE_OPTIONS,
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
    expect(
      Object.fromEntries(
        ENABLED_LOCALES.map((locale) => [
          locale,
          APP_LOCALE_OPTIONS[locale].availability,
        ]),
      ),
    ).toEqual({
      en: 'stable',
      ja: 'beta',
      ko: 'stable',
      'zh-CN': 'beta',
    });
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
    expect(
      ENABLED_LOCALES.every((locale) => locale in APP_I18N_RESOURCES),
    ).toBe(true);
  });

  it('describes enabled locale support as reviewed and specific to Simplified Chinese', () => {
    expect(APP_I18N_RESOURCES.ko.translation.locale).toMatchObject({
      availability: {
        beta: '베타',
        stable: '정식',
      },
      currentDescription:
        '한국어, 영어, 일본어, 중국어 간체 UI를 사용할 수 있습니다.',
      description:
        '앱 UI 언어를 선택합니다. 한국어, 영어, 일본어, 중국어 간체 UI를 사용할 수 있습니다.',
      onlySingleLocaleReady: '현재는 {{locale}} UI만 사용할 수 있습니다.',
    });
    expect(APP_I18N_RESOURCES.en.translation.locale).toMatchObject({
      availability: {
        beta: 'Beta',
        stable: 'Stable',
      },
      currentDescription:
        'You can use the UI in Korean, English, Japanese, or Simplified Chinese.',
      description:
        'Choose the app UI language. Korean, English, Japanese, and Simplified Chinese are available.',
      onlySingleLocaleReady: 'Only {{locale}} is currently available.',
    });
    expect(APP_I18N_RESOURCES.ja.translation.locale).toMatchObject({
      availability: {
        beta: 'ベータ',
        stable: '正式版',
      },
      currentDescription:
        '韓国語、英語、日本語、簡体中国語のUIを利用できます。',
      description:
        'アプリのUI言語を選びます。韓国語、英語、日本語、簡体中国語のUIを利用できます。',
      onlySingleLocaleReady: '現在は{{locale}}のUIのみ利用できます。',
    });
    expect(APP_I18N_RESOURCES['zh-CN'].translation.locale).toMatchObject({
      availability: {
        beta: 'Beta',
        stable: '正式',
      },
      currentDescription: '可使用韩语、英语、日语或简体中文界面。',
      description: '选择应用界面语言。可使用韩语、英语、日语和简体中文界面。',
      onlySingleLocaleReady: '当前仅可使用{{locale}}界面。',
    });

    const localeCopy = ENABLED_LOCALES.map(
      (locale) => APP_I18N_RESOURCES[locale].translation.locale,
    );

    expect(JSON.stringify(localeCopy)).not.toMatch(
      /still being refined|아직 다듬는 중|調整中|仍在完善|onlyKoreanReady|Only Korean|한국어만|韓国語のみ|仅可使用韩语/,
    );
  });
});
