import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppLocaleRuntime } from './AppLocaleRuntime';
import { changeAppLocale } from './i18n';

describe('AppLocaleRuntime', () => {
  it('keeps the html lang attribute synchronized with the app locale', async () => {
    document.documentElement.lang = 'en';

    render(<AppLocaleRuntime />);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'ko');
    });

    await changeAppLocale('ko');

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'ko');
    });
  });
});
