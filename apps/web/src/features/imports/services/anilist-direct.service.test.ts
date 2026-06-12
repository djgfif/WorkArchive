import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAniListSearchableMediumType,
  searchAniListDirectCandidates,
} from './anilist-direct.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildMedia(overrides: Record<string, unknown> = {}) {
  return {
    id: 101922,
    format: 'TV',
    countryOfOrigin: 'JP',
    description: 'Tanjiro sets out to <br>avenge his family.<i>!</i>',
    episodes: 26,
    chapters: null,
    volumes: null,
    genres: ['Action', 'Fantasy'],
    siteUrl: 'https://anilist.co/anime/101922',
    startDate: { year: 2019 },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/cover-xl.jpg',
      large: 'https://s4.anilist.co/file/cover-l.jpg',
    },
    title: {
      romaji: 'Kimetsu no Yaiba',
      english: 'Demon Slayer: Kimetsu no Yaiba',
      native: '鬼滅の刃',
    },
    synonyms: ['귀멸의 칼날', 'KnY'],
    staff: {
      edges: [
        { role: 'Original Creator', node: { name: { full: '고토게 코요하루' } } },
      ],
    },
    ...overrides,
  };
}

describe('isAniListSearchableMediumType', () => {
  it('serves anime, manga, webtoon, light novel, and all', () => {
    expect(isAniListSearchableMediumType('all')).toBe(true);
    expect(isAniListSearchableMediumType('anime')).toBe(true);
    expect(isAniListSearchableMediumType('manga')).toBe(true);
    expect(isAniListSearchableMediumType('webtoon')).toBe(true);
    expect(isAniListSearchableMediumType('light_novel')).toBe(true);
    expect(isAniListSearchableMediumType(undefined)).toBe(true);
  });

  it('declines mediums AniList does not cover', () => {
    expect(isAniListSearchableMediumType('movie')).toBe(false);
    expect(isAniListSearchableMediumType('drama')).toBe(false);
    expect(isAniListSearchableMediumType('novel')).toBe(false);
    expect(isAniListSearchableMediumType('web_novel')).toBe(false);
  });
});

describe('searchAniListDirectCandidates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps AniList media to import candidates and prefers Hangul titles for Hangul queries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          anime: { media: [buildMedia()] },
          manga: { media: [] },
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const candidates = await searchAniListDirectCandidates('귀멸의 칼날');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe('https://graphql.anilist.co');
    expect(init).toMatchObject({ method: 'POST' });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      author: '고토게 코요하루',
      countLabel: '26화',
      externalId: 'anilist:101922',
      formatLabel: 'TV 애니',
      genresText: 'Action, Fantasy',
      mediumType: 'anime',
      releaseYear: 2019,
      sourceId: 'anilist',
      sourceLabel: 'AniList',
      thumbnailUrl: 'https://s4.anilist.co/file/cover-xl.jpg',
      title: '귀멸의 칼날',
      type: 'anime',
    });
    expect(candidates[0]?.description).not.toContain('<');
    expect(candidates[0]?.titleAliases).toContain('鬼滅の刃');
  });

  it('maps manga formats to webtoon and light novel types', async () => {
    const payload = {
      data: {
        manga: {
          media: [
            buildMedia({
              id: 1,
              format: 'MANGA',
              countryOfOrigin: 'KR',
              episodes: null,
              chapters: 179,
            }),
            buildMedia({ id: 2, format: 'NOVEL', episodes: null, volumes: 23 }),
            buildMedia({ id: 3, format: 'MANGA', episodes: null }),
          ],
        },
      },
    };
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(payload)));

    vi.stubGlobal('fetch', fetchMock);

    const candidates = await searchAniListDirectCandidates('test', {
      mediumType: 'manga',
    });

    // mediumType=manga 필터는 webtoon/light_novel 후보를 제외한다.
    expect(candidates.map((candidate) => candidate.type)).toEqual(['manga']);

    const all = await searchAniListDirectCandidates('test');

    expect(all.map((candidate) => candidate.type)).toEqual([
      'webtoon',
      'light_novel',
      'manga',
    ]);
    expect(all[0]?.countLabel).toBe('179화');
    expect(all[1]?.countLabel).toBe('23권');
  });

  it('returns an empty list for unsupported medium types without calling fetch', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      searchAniListDirectCandidates('영화 제목', { mediumType: 'movie' }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on non-ok responses so the caller can fall back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ errors: [] }, 429)),
    );

    await expect(searchAniListDirectCandidates('test')).rejects.toThrow(
      'HTTP 429',
    );
  });
});
