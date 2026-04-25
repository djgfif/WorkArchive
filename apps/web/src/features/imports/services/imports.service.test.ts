import { afterEach, describe, expect, it, vi } from 'vitest';

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
      notice: '검색 provider: open_library',
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

  it('uses an authenticated imports search request when an access token is stored', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
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
      notice: '검색 provider: aladin',
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
});
