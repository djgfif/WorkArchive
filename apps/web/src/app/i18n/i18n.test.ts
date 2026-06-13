import { afterEach, describe, expect, it } from 'vitest';

import { changeAppLocale } from './i18n';
import { APP_LOCALE_STORAGE_KEY } from './locales';

describe('app i18n runtime', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('normalizes disabled locale changes back to Korean', async () => {
    await changeAppLocale('en');

    expect(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)).toBe('ko');
  });
});
