import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredAuthTokens,
  writeStoredAuthTokens,
} from '@features/auth';
import { ImportsService } from './imports.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function getFetchHeaders(init: RequestInit | undefined) {
  return new Headers(init?.headers);
}

describe('ImportsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    window.localStorage.clear();
  });

  it('uses a plain imports search request when no access token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library'],
        query: 'Dune',
        candidates: [],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await new ImportsService().searchCandidates('Dune', {
      providers: ['open_library'],
      useExternal: true,
    });

    expect(result).toMatchObject({
      candidates: [],
      notice: '검색 출처: Open Library',
      source: 'external',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const headers = getFetchHeaders(init as RequestInit | undefined);

    expect(String(input)).toContain('/imports/search?');
    expect(init).toMatchObject({
      method: 'GET',
    });
    expect(headers.has('authorization')).toBe(false);
  });

  it('summarizes safe provider diagnostics when external search includes them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library'],
        query: 'Dune',
        candidates: [],
        diagnostics: {
          providers: [
            {
              provider: 'open_library',
              status: 'searched',
              credentialMode: 'none',
              configured: true,
              resultCount: 0,
              reasonCode: null,
              message: 'Open Library search completed.',
            },
            {
              provider: 'tmdb',
              status: 'skipped',
              credentialMode: 'user',
              configured: false,
              resultCount: 0,
              reasonCode: 'user_credential_missing',
              message: 'TMDB search requires a configured user key.',
            },
            {
              provider: 'google_books',
              status: 'failed',
              credentialMode: 'none',
              configured: true,
              resultCount: 0,
              reasonCode: 'provider_failed',
              message: 'Google Books search is temporarily unavailable.',
            },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await new ImportsService().searchCandidates('Dune', {
      providers: ['open_library'],
      useExternal: true,
    });

    expect(result.diagnostics?.providers).toHaveLength(3);
    expect(result.notice).toContain('검색 출처: Open Library');
    expect(result.notice).toContain(
      '설정에서 개인 API key를 등록하면 사용할 수 있습니다.',
    );
    expect(result.notice).toContain('검색 완료: Open Library 0개');
    expect(result.notice).toContain('제외됨: TMDB');
    expect(result.notice).toContain('일시 실패: Google Books');
  });

  it('shows a friendly notice when a provider circuit is open', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library', 'google_books'],
        query: 'Dune',
        candidates: [],
        diagnostics: {
          providers: [
            {
              provider: 'open_library',
              status: 'skipped',
              credentialMode: 'none',
              configured: true,
              resultCount: 0,
              reasonCode: 'circuit_open',
              message: 'Open Library search is temporarily skipped after repeated failures.',
            },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await new ImportsService().searchCandidates('Dune', {
      providers: ['open_library', 'google_books'],
      useExternal: true,
    });

    expect(result.notice).toContain(
      '일부 검색 소스가 일시적으로 쉬는 중입니다. 잠시 후 다시 시도하거나 직접 추가하세요.',
    );
    expect(result.notice).not.toContain('제외됨: Open Library');
  });

  it('uses a plain provider readiness request when no access token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          provider: 'manual',
          label: 'Manual',
          credentialMode: 'none',
          configured: true,
          mediumTypes: ['novel'],
        },
      ]),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(new ImportsService().listProviders()).resolves.toEqual([
      expect.objectContaining({
        provider: 'manual',
        configured: true,
      }),
    ]);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const headers = getFetchHeaders(init as RequestInit | undefined);

    expect(String(input)).toContain('/imports/providers');
    expect(headers.has('authorization')).toBe(false);
  });

  it('uses an authenticated imports search request when an access token is stored', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'aladin',
        providers: ['aladin'],
        query: 'Dune',
        candidates: [],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await new ImportsService().searchCandidates('Dune', {
      providers: ['aladin'],
      useExternal: true,
    });

    expect(result).toMatchObject({
      candidates: [],
      notice: '검색 출처: Aladin Book',
      source: 'external',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const headers = getFetchHeaders(init as RequestInit | undefined);

    expect(String(input)).toContain('/imports/search?');
    expect(init).toMatchObject({
      method: 'GET',
    });
    expect(headers.get('authorization')).toBe('Bearer access-token');
  });

  it('posts an authenticated provider key test request', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const response = {
      provider: 'tmdb',
      ok: true,
      message: 'TMDB API key connection test succeeded.',
      reason: null,
      checkedAt: '2026-05-20T00:00:00.000Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));

    vi.stubGlobal('fetch', fetchMock);

    await expect(new ImportsService().testProviderKey('tmdb')).resolves.toEqual(
      response,
    );

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const headers = getFetchHeaders(init as RequestInit | undefined);

    expect(String(input)).toContain('/imports/providers/tmdb/test');
    expect(init).toMatchObject({
      method: 'POST',
    });
    expect(headers.get('authorization')).toBe('Bearer access-token');
  });

  it.each([401, 403, 502])(
    'falls back to preview/manual candidates when external search returns %i',
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'Provider unavailable',
          },
          status,
        ),
      );

      vi.stubGlobal('fetch', fetchMock);

      const result = await new ImportsService().searchCandidates('Dune', {
        providers: ['open_library'],
        useExternal: true,
      });

      expect(result.source).toBe('preview-manual');
      expect(result.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: 'preview-manual',
            title: 'Dune',
          }),
        ]),
      );
      expect(result.notice).toContain('일부 검색 출처');
      expect(result.notice).toContain('로그인 없이 사용할 수 있는 출처');
      expect(result.notice).toContain('개인 키가 필요한 출처');
      expect(result.notice).not.toBe('로그인해야만 검색 가능');
    },
  );

  it('falls back to preview/manual candidates when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const result = await new ImportsService().searchCandidates('Dune', {
      providers: ['open_library'],
      useExternal: true,
    });

    expect(result.source).toBe('preview-manual');
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'preview-manual',
          title: 'Dune',
        }),
      ]),
    );
    expect(result.notice).toContain('일부 검색 출처');
  });

  it('uses AniList direct candidates before preview when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const directCandidate = {
      sourceId: 'anilist',
      title: '귀멸의 칼날',
      thumbnailUrl: 'https://s4.anilist.co/cover.jpg',
    };
    const searchPublicDirect = vi
      .fn()
      .mockResolvedValue([directCandidate]);

    const result = await new ImportsService(
      undefined,
      searchPublicDirect,
    ).searchCandidates('귀멸의 칼날', {
      useExternal: true,
    });

    expect(searchPublicDirect).toHaveBeenCalledWith('귀멸의 칼날', {
      mediumType: 'all',
    });
    expect(result.source).toBe('external');
    expect(result.candidates).toEqual([directCandidate]);
    expect(result.notice).toContain('AniList 공개 검색');
  });

  it('skips AniList direct search for medium types it cannot serve', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const searchPublicDirect = vi.fn().mockResolvedValue([]);

    const result = await new ImportsService(
      undefined,
      searchPublicDirect,
    ).searchCandidates('미스터리 영화', {
      mediumType: 'movie',
      useExternal: true,
    });

    expect(searchPublicDirect).not.toHaveBeenCalled();
    expect(result.source).toBe('preview-manual');
  });

  it('falls back to preview when AniList direct search also fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const searchPublicDirect = vi
      .fn()
      .mockRejectedValue(new Error('AniList unavailable'));

    const result = await new ImportsService(
      undefined,
      searchPublicDirect,
    ).searchCandidates('Dune', {
      useExternal: true,
    });

    expect(result.source).toBe('preview-manual');
    expect(result.notice).toContain('일부 검색 출처');
  });
});
