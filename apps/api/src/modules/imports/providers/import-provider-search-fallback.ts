import { normalizeImportTitleSignal } from '../candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import { normalizeProviderSearchQuery } from './import-candidate-builder';

export function getProviderSearchQueryVariants(query: string) {
  const normalized = normalizeProviderSearchQuery(query);
  const withoutBracketSuffix = normalizeProviderSearchQuery(
    normalized.replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, ''),
  );
  const withoutVolumeSuffix = normalizeProviderSearchQuery(
    withoutBracketSuffix.replace(
      /\s*(?:(?:vol(?:ume)?\.?|book|시즌|season)\s*\d+|\d+\s*(?:권|화|회|장|부))\s*$/iu,
      '',
    ),
  );
  const withoutNumericSuffix = normalizeProviderSearchQuery(
    withoutVolumeSuffix.replace(/\s+\d+\s*$/u, ''),
  );
  const baseVariants = [
    normalized,
    withoutBracketSuffix,
    withoutVolumeSuffix,
    withoutNumericSuffix,
  ].filter(Boolean);
  const fallbackVariants = baseVariants.flatMap((variant) => {
    return [
      stripTrailingMediumHint(variant),
      ...getTrailingTokenStrippedVariants(variant),
      getCompactHangulVariant(variant),
    ];
  });

  return Array.from(
    new Set([...baseVariants, ...fallbackVariants].filter(Boolean)),
  );
}

function stripTrailingMediumHint(query: string) {
  return normalizeProviderSearchQuery(
    query.replace(
      /\s*(?:애니메이션|애니|만화|웹툰|드라마|영화|소설|라노벨|light\s*novel|manga|anime|animation|movie|film|drama|series)\s*$/iu,
      '',
    ),
  );
}

function getTrailingTokenStrippedVariants(query: string) {
  const tokens = query.split(/\s+/u).filter(Boolean);

  if (tokens.length < 2) {
    return [];
  }

  const variants: string[] = [];
  const maxRemoveCount = Math.min(2, tokens.length - 1);

  for (let removeCount = 1; removeCount <= maxRemoveCount; removeCount += 1) {
    const removedTokens = tokens.slice(tokens.length - removeCount);
    const removedText = removedTokens.join('');

    if (!isLikelyTrailingCreatorOrHint(removedText)) {
      continue;
    }

    variants.push(
      normalizeProviderSearchQuery(tokens.slice(0, -removeCount).join(' ')),
    );
  }

  return variants;
}

function isLikelyTrailingCreatorOrHint(value: string) {
  return (
    /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,12}$/u.test(
      value,
    ) || /^(?:author|director|creator|writer)$/iu.test(value)
  );
}

function getCompactHangulVariant(query: string) {
  const tokens = query.split(/\s+/u).filter(Boolean);

  if (
    tokens.length < 2 ||
    !tokens.every((token) => /^[\p{Script=Hangul}]+$/u.test(token))
  ) {
    return '';
  }

  return normalizeProviderSearchQuery(tokens.join(''));
}

export function shouldTrySearchFallback(
  candidates: ImportCandidateResponseDto[],
  query: string,
) {
  return (
    candidates.length === 0 ||
    !candidates.some((candidate) => hasStrongTitleSignal(candidate, query))
  );
}

export function hasStrongTitleSignal(
  candidate: ImportCandidateResponseDto,
  query: string,
) {
  const normalizedQuery = normalizeImportTitleSignal(query);

  if (!normalizedQuery) {
    return false;
  }

  return [candidate.title, ...(candidate.titleAliases ?? [])]
    .map(normalizeImportTitleSignal)
    .some((titleSignal) => {
      return (
        titleSignal === normalizedQuery ||
        titleSignal.includes(normalizedQuery) ||
        normalizedQuery.includes(titleSignal)
      );
    });
}
