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

  return Array.from(
    new Set(
      [
        normalized,
        withoutBracketSuffix,
        withoutVolumeSuffix,
        withoutNumericSuffix,
      ].filter(Boolean),
    ),
  );
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
