import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  requestApi,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from './api-client';
import { readStoredAuthTokens } from '../../features/auth/services/auth-storage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('retries a 401 protected request once after refresh succeeds', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'rotated-access-token',
          user: {
            email: 'user@example.com',
            id: 'user-1',
            nickname: '',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestAuthenticatedApiJson('/sync/pull', {
        method: 'POST',
        body: JSON.stringify({
          since: null,
        }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/auth/refresh'),
    );
    expect(
      new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).get(
        'authorization',
      ),
    ).toBe('Bearer rotated-access-token');
  });

  it('clears tokens when refresh fails after a protected 401', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
        .mockResolvedValueOnce(jsonResponse({ message: 'refresh failed' }, 401)),
    );

    await expect(
      requestAuthenticatedApiJson('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          changes: [],
        }),
      }),
    ).rejects.toBeInstanceOf(ApiRequestError);

    expect(readStoredAuthTokens()).toBeNull();
  });

  it('normalizes non-JSON error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('service unavailable', {
          status: 503,
        }),
      ),
    );

    await expect(
      requestApi('/imports/search?query=Dune', {
        method: 'GET',
      }),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it('accepts empty 204 responses for void authenticated requests', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
        }),
      ),
    );

    await expect(
      requestAuthenticatedApi('/imports/providers/aladin/key', {
        method: 'DELETE',
      }),
    ).resolves.toBeUndefined();
  });

  it('normalizes network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network request failed')),
    );

    await expect(
      requestApi('/imports/providers', {
        method: 'GET',
      }),
    ).rejects.toMatchObject({
      message: '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
      status: 0,
    });
  });

  it('sends guest plain requests without authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));

    vi.stubGlobal('fetch', fetchMock);

    await requestApi('/imports/providers', {
      method: 'GET',
    });

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);

    expect(headers.has('authorization')).toBe(false);
  });

  it('keeps non-JSON bodies under caller-owned content type', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const body = new FormData();

    body.set('file', new Blob(['hello']), 'hello.txt');
    vi.stubGlobal('fetch', fetchMock);

    await requestAuthenticatedApiJson('/imports/resolve', {
      method: 'POST',
      body,
    });

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);

    expect(headers.get('authorization')).toBe('Bearer access-token');
    expect(headers.has('content-type')).toBe(false);
  });
});
