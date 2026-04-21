import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  requestAuthenticatedApiJson,
  restoreStoredSession,
} from './auth.api';
import { readStoredAuthTokens } from './auth-storage';

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
    window.localStorage.clear();
  });

  it('retries protected API requests with a refreshed Bearer token', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
      }),
    );

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

  it('restores a stored session after refreshing an expired access token', async () => {
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
              id: 'user-1',
              email: 'frieren@example.com',
              nickname: '',
            },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          }),
        ),
    );

    await expect(restoreStoredSession()).resolves.toEqual({
      tokens: {
        accessToken: 'rotated-access-token',
      },
      user: {
        id: 'user-1',
        email: 'frieren@example.com',
        nickname: '',
      },
    });
  });

  it('clears stored tokens when refresh fails for a protected request', async () => {
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

  it('keeps stored tokens when restore fails due to network error', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network request failed')),
    );

    await expect(restoreStoredSession()).resolves.toBeNull();
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'access-token',
    });
  });
});
