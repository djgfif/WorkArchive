import { describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

import {
  consumeGoogleOAuthFlow,
  getAllowedOAuthReturnOrigin,
  getAuthSessionMetadata,
  getGoogleLoginFailureRedirectUrl,
  getGoogleLoginSuccessRedirectUrl,
  getGoogleOAuthCookieOptions,
  getGoogleOAuthFlowCookieOptions,
  GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
} from '../src/modules/auth/auth-google-oauth';
import { hashSecret } from '../src/modules/auth/auth-crypto';

const oauthConfig = {
  corsOrigin: ['http://localhost:5173', 'https://app.example.com/some-path'],
  webBaseUrl: 'http://localhost:18730',
};

describe('auth google oauth helpers', () => {
  it('allows only configured return origins and falls back to web base origin', () => {
    expect(
      getAllowedOAuthReturnOrigin('https://app.example.com/works', oauthConfig),
    ).toBe('https://app.example.com');
    expect(
      getAllowedOAuthReturnOrigin('http://localhost:5173/auth', oauthConfig),
    ).toBe('http://localhost:5173');
    expect(
      getAllowedOAuthReturnOrigin('https://evil.example', oauthConfig),
    ).toBe('http://localhost:18730');
    expect(getAllowedOAuthReturnOrigin('javascript:alert(1)', oauthConfig)).toBe(
      'http://localhost:18730',
    );
    expect(getAllowedOAuthReturnOrigin('', oauthConfig)).toBe(
      'http://localhost:18730',
    );
  });

  it('builds Google login redirect URLs from the allowed origin', () => {
    expect(
      getGoogleLoginSuccessRedirectUrl(
        'https://app.example.com/anything',
        oauthConfig,
      ),
    ).toBe('https://app.example.com/auth/google/complete');
    expect(
      getGoogleLoginFailureRedirectUrl(
        'unconfigured',
        'https://evil.example',
        oauthConfig,
      ),
    ).toBe('http://localhost:18730/auth/login?google=unconfigured');
  });

  it('builds OAuth cookie options without exposing state or nonce cookies', () => {
    expect(getGoogleOAuthCookieOptions({ cookieSecure: false })).toEqual({
      httpOnly: true,
      path: '/api/auth/google',
      sameSite: 'lax',
      secure: false,
    });
    expect(getGoogleOAuthFlowCookieOptions({ cookieSecure: true })).toEqual({
      httpOnly: true,
      maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
      path: '/api/auth/google',
      sameSite: 'lax',
      secure: true,
    });
  });

  it('reads request metadata without leaking raw auth headers', () => {
    const metadata = getAuthSessionMetadata({
      headers: {
        authorization: 'Bearer access-token',
        'user-agent': ['Desktop', 'Browser'],
      },
      ip: '127.0.0.1',
      requestId: 'req-1',
    } as unknown as Request);

    expect(metadata).toEqual({
      ipAddress: '127.0.0.1',
      requestId: 'req-1',
      userAgent: 'Desktop Browser',
    });
  });

  it('consumes and validates stored Google OAuth flows', async () => {
    const stateHash = await hashSecret('oauth-state');
    const consumeFlow = jest.fn(async () => ({
      expiresAt: Date.now() + 1000,
      nonceHash: 'nonce-hash',
      returnOrigin: 'http://localhost:18730',
      stateHash,
    }));

    await expect(
      consumeGoogleOAuthFlow('flow-1', 'oauth-state', consumeFlow),
    ).resolves.toEqual({
      failureReason: null,
      flow: expect.objectContaining({
        nonceHash: 'nonce-hash',
      }),
    });
    expect(consumeFlow).toHaveBeenCalledWith('flow-1');
  });

  it('classifies missing, stale, and invalid OAuth flow state', async () => {
    const consumeFlow = jest.fn(async () => null);
    const validStateHash = await hashSecret('valid-state');

    await expect(
      consumeGoogleOAuthFlow(null, 'state', consumeFlow),
    ).resolves.toEqual({
      failureReason: 'missing_oauth_flow_cookie',
      flow: null,
    });
    await expect(
      consumeGoogleOAuthFlow('flow-1', null, consumeFlow),
    ).resolves.toEqual({
      failureReason: 'missing_oauth_state',
      flow: null,
    });
    await expect(
      consumeGoogleOAuthFlow('flow-1', 'state', consumeFlow),
    ).resolves.toEqual({
      failureReason: 'oauth_flow_not_found',
      flow: null,
    });
    await expect(
      consumeGoogleOAuthFlow('flow-2', 'wrong-state', async () => ({
        expiresAt: Date.now() + 1000,
        nonceHash: 'nonce-hash',
        returnOrigin: 'http://localhost:18730',
        stateHash: validStateHash,
      })),
    ).resolves.toEqual({
      failureReason: 'invalid_oauth_state',
      flow: null,
    });
  });
});
