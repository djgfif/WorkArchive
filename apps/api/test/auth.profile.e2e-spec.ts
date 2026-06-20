import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '../src/modules/auth/auth.cookies';
import { GoogleOAuthFlowStoreService } from '../src/modules/auth/google-oauth-flow-store.service';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { SecurityAuditService } from '../src/security/security-audit.service';

describe('auth profile API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let authService: {
    loginWithGoogleAuthorizationCode: jest.MockedFunction<
      AuthService['loginWithGoogleAuthorizationCode']
    >;
    refresh: jest.MockedFunction<AuthService['refresh']>;
    revokeRefreshSession: jest.MockedFunction<AuthService['revokeRefreshSession']>;
    toSessionResponse: jest.MockedFunction<AuthService['toSessionResponse']>;
    updateProfile: jest.MockedFunction<AuthService['updateProfile']>;
    validateAccessToken: jest.MockedFunction<AuthService['validateAccessToken']>;
  };
  let securityAudit: {
    record: jest.MockedFunction<SecurityAuditService['record']>;
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';

    authService = {
      loginWithGoogleAuthorizationCode: jest.fn<
        AuthService['loginWithGoogleAuthorizationCode']
      >(),
      refresh: jest.fn<AuthService['refresh']>(),
      revokeRefreshSession: jest
        .fn<AuthService['revokeRefreshSession']>()
        .mockResolvedValue({
          revokedCurrent: false,
        }),
      toSessionResponse: jest
        .fn<AuthService['toSessionResponse']>()
        .mockImplementation((session) => ({
          accessToken: session.accessToken,
          user: session.user,
        })),
      updateProfile: jest.fn<AuthService['updateProfile']>().mockResolvedValue({
        authAccounts: [],
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'frieren@example.com',
        handle: 'mage_frieren',
        id: 'user-1',
        nickname: 'Mage Frieren',
        role: 'user',
      }),
      validateAccessToken: jest
        .fn<AuthService['validateAccessToken']>()
        .mockResolvedValue({
          email: 'frieren@example.com',
          role: 'user',
          sessionId: 'session-1',
          userId: 'user-1',
        }),
    };
    securityAudit = {
      record: jest.fn<SecurityAuditService['record']>().mockResolvedValue(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: SecurityAuditService,
          useValue: securityAudit,
        },
        {
          provide: GoogleOAuthFlowStoreService,
          useValue: {
            consume: jest
              .fn<GoogleOAuthFlowStoreService['consume']>()
              .mockResolvedValue(null),
            onModuleDestroy: jest
              .fn<GoogleOAuthFlowStoreService['onModuleDestroy']>()
              .mockResolvedValue(),
            store: jest
              .fn<GoogleOAuthFlowStoreService['store']>()
              .mockResolvedValue(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureApp(app, readApiRuntimeConfig());
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('updates the authenticated profile', async () => {
    const response = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
    );
    expect(response.status).toBe(200);
    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', {
      handle: 'mage_frieren',
      nickname: 'Mage Frieren',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('rejects malformed refresh session ids before revocation service calls', async () => {
    const response = await fetch(
      `${baseUrl}/api/auth/sessions/not-a-session-id`,
      {
        headers: {
          authorization: 'Bearer access-token',
        },
        method: 'DELETE',
      },
    );

    expect(response.status).toBe(400);
    expect(authService.revokeRefreshSession).not.toHaveBeenCalled();
  });

  it('redirects Google callbacks with missing OAuth flow cookies to login failure', async () => {
    const response = await fetch(
      `${baseUrl}/api/auth/google/callback?code=oauth-code&state=oauth-state`,
      {
        redirect: 'manual',
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:18730/auth/login?google=failed',
    );
    expect(authService.loginWithGoogleAuthorizationCode).not.toHaveBeenCalled();
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason: 'missing_oauth_flow_cookie',
        },
        severity: 'warning',
      }),
    );
  });

  it('does not overwrite the refresh cookie for a grace-window refresh race response', async () => {
    authService.refresh.mockResolvedValue({
      accessToken: 'race-access-token',
      refreshToken: null,
      rememberMe: true,
      sessionId: 'session-1',
      user: {
        authAccounts: [],
        avatarUrl: '',
        email: 'frieren@example.com',
        handle: null,
        id: 'user-1',
        nickname: '',
        role: 'user',
      },
    });

    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=stale-refresh-token`,
      },
      method: 'POST',
    });

    await expect(response.json()).resolves.toEqual({
      accessToken: 'race-access-token',
      user: expect.objectContaining({
        email: 'frieren@example.com',
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(authService.refresh).toHaveBeenCalledWith(
      'stale-refresh-token',
      expect.objectContaining({
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
      }),
    );
  });

  it('requires a bearer token and rejects invalid handles', async () => {
    const missingAuthResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: '',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    expect(missingAuthResponse.status).toBe(401);

    const invalidHandleResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      body: JSON.stringify({
        avatarUrl: '',
        handle: 'Mage',
        nickname: 'Mage Frieren',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'PATCH',
    });

    expect(invalidHandleResponse.status).toBe(400);
    expect(authService.updateProfile).toHaveBeenCalledTimes(0);
  });
});
