import { appI18n } from '@app/i18n';

export interface WebNovelKeywordGroup {
  label: string;
  keywords: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeKeywordList(value: unknown) {
  return isStringArray(value)
    ? Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)))
    : [];
}

function normalizeKeywordGroups(value: unknown): WebNovelKeywordGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('label' in item) ||
      !('keywords' in item) ||
      typeof item.label !== 'string'
    ) {
      return [];
    }

    const keywords = normalizeKeywordList(item.keywords);

    return keywords.length > 0
      ? [{ label: item.label.trim(), keywords }]
      : [];
  });
}

/**
 * Built-in recommendation keywords are UI suggestions, not user data. Keep them
 * behind i18n so future enabled locales can swap the suggestion vocabulary.
 */
export function getWebNovelKeywordGroups() {
  return normalizeKeywordGroups(
    appI18n.t('works.form.webNovelKeywordGroups', { returnObjects: true }),
  );
}

export function getWebNovelKeywords() {
  return getWebNovelKeywordGroups().flatMap((group) => group.keywords);
}

export function getPopularWebNovelKeywords() {
  return normalizeKeywordList(
    appI18n.t('works.form.popularWebNovelKeywords', { returnObjects: true }),
  );
}
