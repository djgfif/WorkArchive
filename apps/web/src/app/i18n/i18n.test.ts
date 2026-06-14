import { afterEach, describe, expect, it } from 'vitest';

import { changeAppLocale } from './i18n';
import { APP_LOCALE_STORAGE_KEY } from './locales';

describe('app i18n runtime', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('changes to reviewed app locales and persists the selection', async () => {
    await changeAppLocale('en');

    expect(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('normalizes unsupported locale changes back to Korean', async () => {
    await changeAppLocale('fr' as never);

    expect(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)).toBe('ko');
  });
});
