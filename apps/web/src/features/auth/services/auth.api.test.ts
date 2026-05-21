import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  fetchAuthSessions,
  fetchGoogleAuthStatus,
  requestAuthenticatedApiJson,
  revokeAllAuthSessions,
  revokeAuthSession,
  restoreStoredSession,
} from './auth.api';
import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  writeStoredAuthTokens,
} from './auth-storage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('auth.api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('fetches public Google OAuth configuration status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        configured: false,
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGoogleAuthStatus()).resolves.toEqual({
      configured: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google/status'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('retries protected API requests with a refreshed Bearer token', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired token.',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'rotated-access-token',
          user: {
            avatarUrl: '',
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          pulledAt: '2026-04-18T01:00:00.000Z',
          nextSince: '2026-04-18T01:00:00.000Z',
          changes: [],
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAuthenticatedApiJson('/sync/pull', {
      method: 'POST',
      body: JSON.stringify({
        since: null,
      }),
    });

    expect(result).toEqual({
      pulledAt: '2026-04-18T01:00:00.000Z',
      nextSince: '2026-04-18T01:00:00.000Z',
      changes: [],
    });
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'rotated-access-token',
    });

    const firstAttemptHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;

    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/auth/refresh'),
    );
    expect(firstAttemptHeaders.get('authorization')).toBe(
      'Bearer expired-access-token',
    );
    expect(retryHeaders.get('authorization')).toBe(
      'Bearer rotated-access-token',
    );
  });

  it('restores a session from the refresh cookie and clears legacy stored tokens', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-access-token',
      }),
    );
    window.sessionStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-session-token',
      }),
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        accessToken: 'rotated-access-token',
        user: {
          avatarUrl: '',
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(restoreStoredSession()).resolves.toEqual({
      tokens: {
        accessToken: 'rotated-access-token',
      },
      user: {
        avatarUrl: '',
        id: 'user-1',
        email: 'frieren@example.com',
        nickname: '',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(window.sessionStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(readStoredAuthTokens()).toBeNull();
  });

  it('clears stored tokens when refresh fails for a protected request', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
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

  it('returns null and clears legacy browser storage when startup refresh fails due to network error', async () => {
    writeStoredAuthTokens({
      accessToken: 'stale-memory-token',
    });
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-access-token',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network request failed')),
    );

    await expect(restoreStoredSession()).resolves.toBeNull();
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'stale-memory-token',
    });
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });

  it('keeps refreshed access tokens in memory instead of browser storage', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            accessToken: 'rotated-access-token',
            user: {
              avatarUrl: '',
              id: 'user-1',
              email: 'frieren@example.com',
              nickname: '',
            },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            pulledAt: '2026-04-18T01:00:00.000Z',
            nextSince: '2026-04-18T01:00:00.000Z',
            changes: [],
          }),
        ),
    );

    await requestAuthenticatedApiJson('/sync/pull', {
      method: 'POST',
      body: JSON.stringify({
        since: null,
      }),
    });

    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(window.sessionStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'rotated-access-token',
    });
  });

  it('shares one refresh request across concurrent protected API retries', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const headers = init?.headers as Headers | undefined;
      const authorizationHeader = headers?.get('authorization');

      if (requestUrl.includes('/auth/refresh')) {
        return jsonResponse({
          accessToken: 'rotated-access-token',
          user: {
            avatarUrl: '',
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
        });
      }

      if (authorizationHeader === 'Bearer expired-access-token') {
        return jsonResponse(
          {
            message: 'Invalid or expired token.',
          },
          401,
        );
      }

      if (authorizationHeader === 'Bearer rotated-access-token') {
        return jsonResponse({
          ok: true,
        });
      }

      return jsonResponse(
        {
          message: 'Unauthorized.',
        },
        401,
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      Promise.all([
        requestAuthenticatedApiJson('/sync/pull', {
          method: 'POST',
          body: JSON.stringify({
            since: null,
          }),
        }),
        requestAuthenticatedApiJson('/sync/push', {
          method: 'POST',
          body: JSON.stringify({
            changes: [],
          }),
        }),
      ]),
    ).resolves.toEqual([
      {
        ok: true,
      },
      {
        ok: true,
      },
    ]);

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh')),
    ).toHaveLength(1);
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'rotated-access-token',
    });
  });

  it('clears memory tokens for all concurrent protected requests when shared refresh fails', async () => {
    writeStoredAuthTokens({
      accessToken: 'expired-access-token',
    });

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const headers = init?.headers as Headers | undefined;
      const authorizationHeader = headers?.get('authorization');

      if (requestUrl.includes('/auth/refresh')) {
        return jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        );
      }

      if (authorizationHeader === 'Bearer expired-access-token') {
        return jsonResponse(
          {
            message: 'Invalid or expired token.',
          },
          401,
        );
      }

      return jsonResponse({
        ok: true,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.allSettled([
      requestAuthenticatedApiJson('/sync/pull', {
        method: 'POST',
        body: JSON.stringify({
          since: null,
        }),
      }),
      requestAuthenticatedApiJson('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          changes: [],
        }),
      }),
    ]);

    expect(results).toEqual([
      expect.objectContaining({
        status: 'rejected',
      }),
      expect.objectContaining({
        status: 'rejected',
      }),
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh')),
    ).toHaveLength(1);
    expect(readStoredAuthTokens()).toBeNull();
  });

  it('calls auth session management endpoints with the current access token', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });

    const fetchMock = vi.fn(
      (url: string | URL | Request, _init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions') && !requestUrl.includes('revoke-all')) {
        return Promise.resolve(
          jsonResponse({
            sessions: [
              {
                id: 'session-1',
                current: true,
                rememberMe: true,
                userAgent: 'Vitest',
                ipAddress: '127.0.0.1',
                createdAt: '2026-05-12T00:00:00.000Z',
                lastUsedAt: null,
                rotatedAt: null,
                expiresAt: '2026-06-11T00:00:00.000Z',
              },
            ],
          }),
        );
      }

      return Promise.resolve(new Response(null, { status: 204 }));
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthSessions()).resolves.toEqual({
      sessions: [
        expect.objectContaining({
          id: 'session-1',
          current: true,
        }),
      ],
    });
    await expect(revokeAuthSession('session-1')).resolves.toBeUndefined();
    await expect(revokeAllAuthSessions()).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/auth/sessions'),
        expect.stringContaining('/auth/sessions/session-1'),
        expect.stringContaining('/auth/sessions/revoke-all'),
      ]),
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get('authorization')).toBe(
        'Bearer access-token',
      );
    }
  });
});
