import {
  BadGatewayException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import type { ProviderSearchContext } from '../src/modules/imports/providers/import-provider-adapter';
import type { ImportProviderSearchRuntime } from '../src/modules/imports/providers/import-provider-search-runtime';
import { getWebSourceLabel } from '../src/modules/imports/providers/import-candidate-web-mappers';
import {
  searchAladin,
  searchGoogleBooks,
  searchNaverBook,
} from '../src/modules/imports/providers/import-provider-search-books';
import {
  searchAniList,
  searchTvMaze,
} from '../src/modules/imports/providers/import-provider-search-media';
import { searchManual } from '../src/modules/imports/providers/import-provider-search-manual';
import { searchBrave } from '../src/modules/imports/providers/import-provider-search-web';
import { searchWikidata } from '../src/modules/imports/providers/import-provider-search-wikidata';

function createContext(
  overrides: Partial<ProviderSearchContext> = {},
): ProviderSearchContext {
  return {
    limit: 5,
    query: '테스트',
    userId: null,
    ...overrides,
  };
}

function createRuntime(
  overrides: Partial<ImportProviderSearchRuntime> = {},
): jest.Mocked<ImportProviderSearchRuntime> {
  return {
    fetchJson: jest.fn<ImportProviderSearchRuntime['fetchJson']>(),
    getProviderCredentialValues:
      jest.fn<ImportProviderSearchRuntime['getProviderCredentialValues']>(),
    getProviderCredentialValuesWithFallback:
      jest.fn<
        ImportProviderSearchRuntime['getProviderCredentialValuesWithFallback']
      >(),
    ...overrides,
  } as unknown as jest.Mocked<ImportProviderSearchRuntime>;
}

describe('import provider search modules', () => {
  it('keeps manual provider deterministic without network or credentials', () => {
    const candidates = searchManual(createContext({ query: '직접 입력' }));

    expect(candidates).toHaveLength(7);
    expect(candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: 'manual',
        title: expect.stringContaining('직접 입력'),
      }),
    );
  });

  it('rejects credentialed book providers before making an external request', async () => {
    const runtime = createRuntime();

    runtime.getProviderCredentialValues.mockResolvedValue(null);

    await expect(
      searchNaverBook(
        createContext({
          mediumType: WorkType.novel,
          userId: 'user-1',
        }),
        runtime,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(runtime.fetchJson).not.toHaveBeenCalled();
  });

  it('fails clearly on malformed Aladin item lists', async () => {
    const runtime = createRuntime();

    runtime.getProviderCredentialValues.mockResolvedValue({
      ttbKey: 'ttb-test',
    });
    runtime.fetchJson.mockResolvedValue({
      item: {
        title: '배열이 아닌 응답',
      },
    });

    await expect(
      searchAladin(
        createContext({
          mediumType: WorkType.novel,
          userId: 'user-1',
        }),
        runtime,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('filters Google Books candidates by requested medium', async () => {
    const runtime = createRuntime();

    runtime.fetchJson.mockResolvedValue({
      items: [
        {
          id: 'manga-1',
          volumeInfo: {
            categories: ['manga'],
            title: 'Manga Candidate',
          },
        },
      ],
    });

    await expect(
      searchGoogleBooks(
        createContext({
          mediumType: WorkType.novel,
        }),
        runtime,
      ),
    ).resolves.toEqual([]);
    await expect(
      searchGoogleBooks(
        createContext({
          mediumType: WorkType.manga,
        }),
        runtime,
      ),
    ).resolves.toHaveLength(1);
  });

  it('limits AniList queries to the requested media family', async () => {
    const runtime = createRuntime();

    runtime.fetchJson.mockResolvedValue({
      data: {
        Page: {
          media: [
            {
              id: 1,
              title: {
                romaji: 'Frieren',
              },
            },
          ],
        },
      },
    });

    const candidates = await searchAniList(
      createContext({
        mediumType: WorkType.anime,
      }),
      runtime,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.mediumType).toBe(WorkType.anime);
    expect(runtime.fetchJson).toHaveBeenCalledTimes(1);
  });

  it('treats malformed TVMaze responses as empty results', async () => {
    const runtime = createRuntime();

    runtime.fetchJson.mockResolvedValue({
      unexpected: true,
    });

    await expect(searchTvMaze(createContext(), runtime)).resolves.toEqual([]);
  });

  it('requires a signed-in user before credentialed web search', async () => {
    const runtime = createRuntime();

    await expect(searchBrave(createContext(), runtime)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(runtime.getProviderCredentialValues).not.toHaveBeenCalled();
    expect(runtime.fetchJson).not.toHaveBeenCalled();
  });

  it('returns no Wikidata candidates when entity hydration is malformed', async () => {
    const runtime = createRuntime();

    runtime.fetchJson
      .mockResolvedValueOnce({
        search: [
          {
            id: 'Q123',
          },
        ],
      })
      .mockResolvedValueOnce({
        entities: 'malformed',
      });

    await expect(searchWikidata(createContext(), runtime)).resolves.toEqual([]);
  });

  it('matches web source hostnames on DNS label boundaries', () => {
    expect(getWebSourceLabel('https://ridibooks.com/books/1')).toBe('Ridi');
    expect(getWebSourceLabel('https://library.ridibooks.com/books/1')).toBe(
      'Ridi',
    );
    expect(getWebSourceLabel('https://evilridibooks.com/books/1')).toBe(
      'evilridibooks.com',
    );
  });
});
