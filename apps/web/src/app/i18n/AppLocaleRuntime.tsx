import { useEffect } from 'react';

import { useAppLocale } from './hooks';

export function AppLocaleRuntime() {
  const { locale } = useAppLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
