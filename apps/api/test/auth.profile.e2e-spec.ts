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
    revokeRefreshSession: jest.MockedFunction<AuthService['revokeRefreshSession']>;
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
      revokeRefreshSession: jest
        .fn<AuthService['revokeRefreshSession']>()
        .mockResolvedValue({
          revokedCurrent: false,
        }),
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
