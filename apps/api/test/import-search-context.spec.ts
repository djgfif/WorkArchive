import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import { buildImportSearchContext } from '../src/modules/imports/import-search-context';
import {
  ALADIN_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  MANUAL_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
} from '../src/modules/imports/imports.constants';

describe('buildImportSearchContext', () => {
  it('normalizes query, limit, medium, and automatic providers', () => {
    expect(
      buildImportSearchContext({
        searchQuery: {
          limit: 999,
          query: '  Dune  ',
          type: WorkType.novel,
        },
        serverSearchGuestEnabled: false,
        userId: 'user-1',
      }),
    ).toEqual(
      expect.objectContaining({
        explicitSingleProvider: false,
        limit: 20,
        mediumType: WorkType.novel,
        query: 'Dune',
        responseProvider: ALADIN_PROVIDER,
      }),
    );
  });

  it('marks single-provider requests explicitly', () => {
    expect(
      buildImportSearchContext({
        searchQuery: {
          provider: OPEN_LIBRARY_PROVIDER,
          query: 'Dune',
        },
        serverSearchGuestEnabled: false,
        userId: null,
      }),
    ).toEqual(
      expect.objectContaining({
        explicitSingleProvider: true,
        providers: [OPEN_LIBRARY_PROVIDER],
        resolvedProviders: [OPEN_LIBRARY_PROVIDER],
        responseProvider: OPEN_LIBRARY_PROVIDER,
      }),
    );
  });

  it('does not mark provider lists as explicit single-provider searches', () => {
    expect(
      buildImportSearchContext({
        searchQuery: {
          providers: [GOOGLE_BOOKS_PROVIDER, MANUAL_PROVIDER],
          query: 'Dune',
        },
        serverSearchGuestEnabled: false,
        userId: null,
      }),
    ).toEqual(
      expect.objectContaining({
        explicitSingleProvider: false,
        providers: [GOOGLE_BOOKS_PROVIDER, MANUAL_PROVIDER],
        responseProvider: GOOGLE_BOOKS_PROVIDER,
      }),
    );
  });

  it('rejects blank queries after trimming', () => {
    expect(() =>
      buildImportSearchContext({
        searchQuery: {
          query: '   ',
        },
        serverSearchGuestEnabled: false,
        userId: null,
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps guest restrictions for user-key providers', () => {
    expect(() =>
      buildImportSearchContext({
        searchQuery: {
          provider: ALADIN_PROVIDER,
          query: 'Dune',
        },
        serverSearchGuestEnabled: false,
        userId: null,
      }),
    ).toThrow(UnauthorizedException);
  });
});
