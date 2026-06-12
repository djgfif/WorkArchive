import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAniListUserEntries } from './anilist-user-list.service';

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
    episodes: 26,
    chapters: null,
    volumes: null,
    description: 'A boy <b>fights</b> demons.',
    siteUrl: 'https://anilist.co/anime/101922',
    startDate: { year: 2019 },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/cover-xl.jpg',
      large: 'https://s4.anilist.co/cover-l.jpg',
    },
    title: {
      romaji: 'Kimetsu no Yaiba',
      english: 'Demon Slayer',
      native: '鬼滅の刃',
    },
    synonyms: ['귀멸의 칼날'],
    staff: {
      edges: [{ role: 'Original Creator', node: { name: { full: '고토게 코요하루' } } }],
    },
    ...overrides,
  };
}

function buildListPayload(
  lists: Array<{ isCustomList?: boolean; entries: unknown[] }>,
) {
  return {
    data: {
      MediaListCollection: {
        lists,
      },
    },
  };
}

describe('fetchAniListUserEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps public list entries with status, rating, progress, and Korean titles', async () => {
    const animePayload = buildListPayload([
      {
        entries: [
          {
            status: 'COMPLETED',
            score: 9,
            progress: 26,
            notes: '명작',
            startedAt: { year: 2024, month: 1, day: 2 },
            completedAt: { year: 2024, month: 2, day: 10 },
            media: buildMedia(),
          },
        ],
      },
      {
        isCustomList: true,
        entries: [
          {
            status: 'COMPLETED',
            score: 9,
            media: buildMedia(),
          },
        ],
      },
    ]);
    const mangaPayload = buildListPayload([
      {
        entries: [
          {
            status: 'CURRENT',
            score: 0,
            progress: 120,
            progressVolumes: 10,
            media: buildMedia({
              id: 105398,
              format: 'NOVEL',
              episodes: null,
              volumes: 23,
              siteUrl: 'https://anilist.co/manga/105398',
              synonyms: [],
              title: {
                romaji: 'Mushoku Tensei',
                english: null,
                native: '無職転生',
              },
            }),
          },
        ],
      },
    ]);
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(animePayload)))
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse(mangaPayload)),
      );

    vi.stubGlobal('fetch', fetchMock);

    const entries = await fetchAniListUserEntries('tester');

    // 커스텀 리스트 중복은 제외하고 표준 리스트만 집계한다.
    expect(entries).toHaveLength(2);

    expect(entries[0]).toMatchObject({
      author: '고토게 코요하루',
      completedAt: '2024-02-10T00:00:00.000Z',
      externalKey: 'anilist:anime:101922',
      progressCurrent: 26,
      progressTotal: 26,
      progressUnit: 'episode',
      rating: 4.5,
      review: '명작',
      startedAt: '2024-01-02T00:00:00.000Z',
      status: 'completed',
      thumbnailUrl: 'https://s4.anilist.co/cover-xl.jpg',
      title: '귀멸의 칼날',
      type: 'anime',
    });

    expect(entries[1]).toMatchObject({
      externalKey: 'anilist:manga:105398',
      progressCurrent: 10,
      progressTotal: 23,
      progressUnit: 'volume',
      rating: null,
      status: 'in_progress',
      title: 'Mushoku Tensei',
      type: 'light_novel',
    });
  });

  it('reports a friendly error when the user does not exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            { errors: [{ message: 'User not found', status: 404 }] },
            404,
          ),
        ),
      ),
    );

    await expect(fetchAniListUserEntries('nope')).rejects.toThrow(
      '사용자명을 찾지 못했습니다',
    );
  });

  it('reports a friendly error for private lists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            { errors: [{ message: 'User list is private.', status: 400 }] },
            400,
          ),
        ),
      ),
    );

    await expect(fetchAniListUserEntries('secret')).rejects.toThrow(
      '비공개입니다',
    );
  });

  it('returns an empty list for a blank user name without calling fetch', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAniListUserEntries('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
