import { getCurrentAppLocale } from './i18n';
import type { AppLocale } from './locales';

function resolveLocale(locale?: AppLocale | null) {
  return locale ?? getCurrentAppLocale();
}

export function formatAppDate(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale?: AppLocale | null,
) {
  return new Intl.DateTimeFormat(resolveLocale(locale), options).format(
    new Date(value),
  );
}

export function formatAppDateTime(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
  locale?: AppLocale | null,
) {
  return formatAppDate(value, options, locale);
}

export function formatAppNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: AppLocale | null,
) {
  return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
}
