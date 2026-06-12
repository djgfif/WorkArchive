import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import type { ImportSearchResponseDto } from './dto/import-search-response.dto';
import type { ImportSearchDiagnostics } from './diagnostics/import-search-diagnostics';
import type { ImportProvider } from './imports.constants';
import { mergeImportCandidates } from './candidates/import-candidate-merge';
import { rankImportCandidates } from './candidates/import-candidate-ranking';

export function mergeImportSearchCandidates(
  candidates: ImportCandidateResponseDto[],
) {
  return mergeImportCandidates(candidates);
}

export function mergeAndRankImportSearchCandidates(input: {
  candidates: ImportCandidateResponseDto[];
  limit: number;
  mediumType: WorkType | undefined;
  query: string;
}) {
  const mergedCandidates = mergeImportCandidates(input.candidates);

  return rankImportCandidates({
    candidates: mergedCandidates,
    ...(input.mediumType === undefined ? {} : { mediumType: input.mediumType }),
    query: input.query,
  }).slice(0, input.limit);
}

export function buildImportSearchResponse(input: {
  candidates: ImportCandidateResponseDto[];
  diagnostics: ImportSearchDiagnostics;
  provider: ImportProvider;
  providers: ImportProvider[];
  query: string;
}): ImportSearchResponseDto {
  return {
    provider: input.provider,
    providers: input.providers,
    query: input.query,
    candidates: input.candidates,
    diagnostics: input.diagnostics,
  };
}
