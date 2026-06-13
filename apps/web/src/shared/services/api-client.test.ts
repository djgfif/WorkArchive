import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  getApiBaseUrl,
  requestApi,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from './api-client';
import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
} from '@features/auth';
import { API_BASE_URL, HttpResponse, http, server } from '@test/msw';

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    clearStoredAuthTokens();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('defaults development API calls to the local API server', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(getApiBaseUrl()).toBe('/api');
  });

  it('normalizes loopback development API overrides to the same-origin proxy', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api');

    expect(getApiBaseUrl()).toBe('/api');
  });

  it('retries a 401 protected request once after refresh succeeds', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });
    const protectedRequests: Request[] = [];
    const refreshRequests: Request[] = [];

    server.use(
      http.post(`${API_BASE_URL}/sync/pull`, ({ request }) => {
        protectedRequests.push(request);

        if (protectedRequests.length === 1) {
          return HttpResponse.json({ message: 'expired' }, { status: 401 });
        }

        return HttpResponse.json({ ok: true });
      }),
      http.post(`${API_BASE_URL}/auth/refresh`, ({ request }) => {
        refreshRequests.push(request);

        return HttpResponse.json({
          accessToken: 'rotated-access-token',
          user: {
            avatarUrl: '',
            email: 'user@example.com',
            id: 'user-1',
            nickname: '',
          },
        });
      }),
    );

    await expect(
      requestAuthenticatedApiJson('/sync/pull', {
        method: 'POST',
        body: JSON.stringify({
          since: null,
        }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(protectedRequests).toHaveLength(2);
    expect(refreshRequests).toHaveLength(1);
    expect(protectedRequests[1]?.headers.get('authorization')).toBe(
      'Bearer rotated-access-token',
    );
    expect(protectedRequests[1]?.headers.get('x-work-archive-client')).toBe(
      'web',
    );
    expect(refreshRequests[0]?.headers.has('x-work-archive-client')).toBe(
      false,
    );
  });

  it('clears tokens when refresh fails after a protected 401', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    server.use(
      http.post(`${API_BASE_URL}/sync/push`, () =>
        HttpResponse.json({ message: 'expired' }, { status: 401 }),
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ message: 'refresh failed' }, { status: 401 }),
      ),
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

  it('treats a 204 refresh during authenticated retry as signed out', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    server.use(
      http.post(`${API_BASE_URL}/sync/push`, () =>
        HttpResponse.json({ message: 'expired' }, { status: 401 }),
      ),
      http.post(
        `${API_BASE_URL}/auth/refresh`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      requestAuthenticatedApiJson('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          changes: [],
        }),
      }),
    ).rejects.toMatchObject({
      status: 401,
    });

    expect(readStoredAuthTokens()).toBeNull();
  });

  it('normalizes non-JSON error responses', async () => {
    server.use(
      http.get(`${API_BASE_URL}/imports/search`, () =>
        HttpResponse.text('service unavailable', {
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

  it('preserves retry-after timing from rate limited responses', async () => {
    server.use(
      http.post(`${API_BASE_URL}/sync/pull`, () =>
        HttpResponse.json(
          { message: 'Too many requests' },
          {
            headers: {
              'retry-after': '42',
            },
            status: 429,
          },
        ),
      ),
    );

    await expect(
      requestApi('/sync/pull', {
        method: 'POST',
      }),
    ).rejects.toMatchObject({
      retryAfterMs: 42_000,
      status: 429,
    });
  });

  it('accepts empty 204 responses for void authenticated requests', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    server.use(
      http.delete(
        `${API_BASE_URL}/imports/providers/aladin/key`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      requestAuthenticatedApi('/imports/providers/aladin/key', {
        method: 'DELETE',
      }),
    ).resolves.toBeUndefined();
  });

  it('normalizes network failures', async () => {
    server.use(
      http.get(`${API_BASE_URL}/imports/providers`, () => Response.error()),
    );

    await expect(
      requestApi('/imports/providers', {
        method: 'GET',
      }),
    ).rejects.toMatchObject({
      status: 0,
    });
  });

  it('aborts timed out requests as timeout failures', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason ?? new Error('aborted')),
            { once: true },
          );
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const requestPromise = requestApi('/imports/providers', {
      method: 'GET',
      timeoutMs: 100,
    });
    const assertion = expect(requestPromise).rejects.toMatchObject({
      failureKind: 'timeout',
      status: 0,
    });

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('sends guest plain requests without authorization', async () => {
    const requests: Request[] = [];

    server.use(
      http.get(`${API_BASE_URL}/imports/providers`, ({ request }) => {
        requests.push(request);

        return HttpResponse.json([]);
      }),
    );

    await requestApi('/imports/providers', {
      method: 'GET',
    });

    expect(requests[0]?.headers.has('authorization')).toBe(false);
    expect(requests[0]?.headers.has('x-work-archive-client')).toBe(false);
  });

  it('adds the Work Archive client header only to authenticated unsafe requests', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const requests: Request[] = [];

    server.use(
      http.get(`${API_BASE_URL}/auth/sessions`, ({ request }) => {
        requests.push(request);

        return HttpResponse.json({ sessions: [] });
      }),
      http.delete(`${API_BASE_URL}/auth/sessions/session-1`, ({ request }) => {
        requests.push(request);

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await requestAuthenticatedApiJson('/auth/sessions', {
      method: 'GET',
    });
    await requestAuthenticatedApi('/auth/sessions/session-1', {
      method: 'DELETE',
    });

    expect(requests[0]?.headers.has('x-work-archive-client')).toBe(false);
    expect(requests[1]?.headers.get('x-work-archive-client')).toBe('web');
  });

  it('keeps non-JSON bodies under caller-owned content type', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const requests: Request[] = [];
    const body = new FormData();

    body.set('file', new Blob(['hello']), 'hello.txt');
    server.use(
      http.post(`${API_BASE_URL}/imports/resolve`, ({ request }) => {
        requests.push(request);

        return HttpResponse.json({ ok: true });
      }),
    );

    await requestAuthenticatedApiJson('/imports/resolve', {
      method: 'POST',
      body,
    });

    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer access-token',
    );
    expect(requests[0]?.headers.get('content-type')).not.toBe(
      'application/json',
    );
  });
});
