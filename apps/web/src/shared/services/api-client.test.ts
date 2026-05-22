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
} from '../../features/auth';
import { API_BASE_URL, HttpResponse, http, server } from '../../test/msw';

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('defaults development API calls to the local API server', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(getApiBaseUrl()).toBe('http://localhost:3000/api');
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
