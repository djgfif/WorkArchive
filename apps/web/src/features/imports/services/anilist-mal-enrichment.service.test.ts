import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExternalImportEntry } from './anilist-user-list.service';
import { enrichMalEntriesWithAniList } from './anilist-mal-enrichment.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildEntry(
  overrides: Partial<ExternalImportEntry> = {},
): ExternalImportEntry {
  return {
    author: '',
    completedAt: null,
    description: '',
    externalKey: 'mal:anime:38000',
    progressCurrent: null,
    progressTotal: null,
    progressUnit: 'episode',
    rating: null,
    review: '',
    sourceLabel: 'MyAnimeList',
    sourceUrl: 'https://myanimelist.net/anime/38000',
    startedAt: null,
    status: 'completed',
    thumbnailUrl: '',
    title: 'Kimetsu no Yaiba',
    type: 'anime',
    ...overrides,
  };
}

function buildMediaPayload(
  media: Array<Record<string, unknown>>,
) {
  return { data: { Page: { media } } };
}

describe('enrichMalEntriesWithAniList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fills covers, authors, and Korean titles from idMal matches', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          buildMediaPayload([
            {
              idMal: 38000,
              coverImage: { extraLarge: 'https://s4.anilist.co/cover.jpg' },
              description: 'Demon slaying.',
              synonyms: ['귀멸의 칼날'],
              title: { romaji: 'Kimetsu no Yaiba' },
              staff: {
                edges: [
                  {
                    role: 'Original Creator',
                    node: { name: { full: '고토게 코요하루' } },
                  },
                ],
              },
            },
          ]),
        ),
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await enrichMalEntriesWithAniList([buildEntry()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.enrichedCoverCount).toBe(1);
    expect(result.entries[0]).toMatchObject({
      author: '고토게 코요하루',
      description: 'Demon slaying.',
      thumbnailUrl: 'https://s4.anilist.co/cover.jpg',
      title: '귀멸의 칼날',
    });
  });

  it('keeps existing fields and skips entries that already have covers', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const entry = buildEntry({
      thumbnailUrl: 'https://existing.example/cover.jpg',
    });
    const result = await enrichMalEntriesWithAniList([entry]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.enrichedCoverCount).toBe(0);
    expect(result.entries[0]).toEqual(entry);
  });

  it('splits anime and manga ids into separate batched queries', async () => {
    const fetchMock = vi.fn().mockImplementation((_, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as {
        variables: { idsMal: number[]; type: string };
      };

      return Promise.resolve(
        jsonResponse(
          buildMediaPayload(
            body.variables.idsMal.map((idMal) => ({
              idMal,
              coverImage: {
                extraLarge: `https://s4.anilist.co/${body.variables.type}/${idMal}.jpg`,
              },
            })),
          ),
        ),
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await enrichMalEntriesWithAniList([
      buildEntry({ externalKey: 'mal:anime:1', title: 'A' }),
      buildEntry({
        externalKey: 'mal:manga:2',
        title: 'B',
        type: 'manga',
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.enrichedCoverCount).toBe(2);
    expect(result.entries[0]?.thumbnailUrl).toContain('ANIME/1');
    expect(result.entries[1]?.thumbnailUrl).toContain('MANGA/2');
  });

  it('keeps going when a batch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('boom')))
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse(
            buildMediaPayload([
              {
                idMal: 2,
                coverImage: { extraLarge: 'https://s4.anilist.co/2.jpg' },
              },
            ]),
          ),
        ),
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await enrichMalEntriesWithAniList([
      buildEntry({ externalKey: 'mal:anime:1', title: 'A' }),
      buildEntry({
        externalKey: 'mal:manga:2',
        title: 'B',
        type: 'manga',
      }),
    ]);

    expect(result.enrichedCoverCount).toBe(1);
    expect(result.entries[0]?.thumbnailUrl).toBe('');
    expect(result.entries[1]?.thumbnailUrl).toBe('https://s4.anilist.co/2.jpg');
  });
});
