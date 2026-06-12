import { BadRequestException } from '@nestjs/common';
import type { WorkType } from '@prisma/client';

import type { ImportSearchQueryDto } from './dto/import-search-query.dto';
import { ALADIN_PROVIDER, type ImportProvider } from './imports.constants';
import {
  normalizeImportSearchLimit,
  resolveGuestSearchProviders,
  resolveImportProviders,
} from './providers/import-provider-selection';

export interface ImportSearchContext {
  explicitSingleProvider: boolean;
  limit: number;
  mediumType: WorkType | undefined;
  providers: ImportProvider[];
  query: string;
  resolvedProviders: ImportProvider[];
  responseProvider: ImportProvider;
}

export function buildImportSearchContext(input: {
  searchQuery: ImportSearchQueryDto;
  serverSearchGuestEnabled: boolean;
  userId: string | null;
}): ImportSearchContext {
  const query = input.searchQuery.query.trim();

  if (!query) {
    throw new BadRequestException('query must not be empty');
  }

  const limit = normalizeImportSearchLimit(input.searchQuery.limit);
  const mediumType = input.searchQuery.mediumType ?? input.searchQuery.type;
  const resolvedProviders = resolveImportProviders(input.searchQuery, mediumType);
  const providers = resolveGuestSearchProviders({
    providers: resolvedProviders,
    searchQuery: input.searchQuery,
    serverSearchGuestEnabled: input.serverSearchGuestEnabled,
    userId: input.userId,
  });

  return {
    explicitSingleProvider:
      input.searchQuery.provider !== undefined &&
      input.searchQuery.providers === undefined,
    limit,
    mediumType,
    providers,
    query,
    resolvedProviders,
    responseProvider: input.searchQuery.provider ?? providers[0] ?? ALADIN_PROVIDER,
  };
}
