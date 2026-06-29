import { type AddressInfo } from 'node:net';

import {
  BadRequestException,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
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
import { MetricsService } from '../src/observability/metrics.service';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { SecurityAuditService } from '../src/security/security-audit.service';

describe('auth profile API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let authService: {
    deleteAccount: jest.MockedFunction<AuthService['deleteAccount']>;
    exportUserData: jest.MockedFunction<AuthService['exportUserData']>;
    loginWithGoogleAuthorizationCode: jest.MockedFunction<
      AuthService['loginWithGoogleAuthorizationCode']
    >;
    previewAccountDeletion: jest.MockedFunction<
      AuthService['previewAccountDeletion']
    >;
    refresh: jest.MockedFunction<AuthService['refresh']>;
    revokeRefreshSession: jest.MockedFunction<
      AuthService['revokeRefreshSession']
    >;
    toSessionResponse: jest.MockedFunction<AuthService['toSessionResponse']>;
    updateProfile: jest.MockedFunction<AuthService['updateProfile']>;
    validateAccountDeletionRequest: jest.MockedFunction<
      AuthService['validateAccountDeletionRequest']
    >;
    validateAccessToken: jest.MockedFunction<
      AuthService['validateAccessToken']
    >;
  };
  let securityAudit: {
    record: jest.MockedFunction<SecurityAuditService['record']>;
  };
  let metricsService: {
    recordRequest: jest.MockedFunction<MetricsService['recordRequest']>;
    recordUserDataRights: jest.MockedFunction<
      MetricsService['recordUserDataRights']
    >;
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';

    authService = {
      deleteAccount: jest.fn<AuthService['deleteAccount']>().mockResolvedValue({
        anonymizedRecords: {
          catalogAuditLogs: 1,
          catalogSubmissionReviews: 1,
          securityEvents: 2,
        },
        deleted: true,
        deletedAt: '2026-06-21T00:00:00.000Z',
        userId: 'user-1',
      }),
      exportUserData: jest
        .fn<AuthService['exportUserData']>()
        .mockResolvedValue({
          counts: {
            externalApiCredentials: 1,
            refreshSessions: 1,
            workRecords: 1,
          },
          data: {
            externalApiCredentials: [
              {
                id: 'credential-1',
                provider: 'aladin',
                createdAt: '2026-06-20T00:00:00.000Z',
                updatedAt: '2026-06-20T00:00:00.000Z',
              },
            ],
            refreshSessions: [],
            workRecords: [],
          },
          exportedAt: '2026-06-20T00:00:00.000Z',
          omittedSensitiveFields: [
            'refresh token hashes',
            'external provider encrypted keys',
          ],
          user: {
            authAccounts: [],
            avatarUrl: '',
            email: 'frieren@example.com',
            handle: 'mage_frieren',
            id: 'user-1',
            nickname: 'Mage Frieren',
            role: 'user',
          },
        }),
      previewAccountDeletion: jest
        .fn<AuthService['previewAccountDeletion']>()
        .mockResolvedValue({
          anonymizedRecords: {
            catalogAuditLogs: 1,
            catalogSubmissionReviews: 1,
            securityEvents: 2,
          },
          cascadeDeletedRecords: {
            authAccounts: 1,
            refreshSessions: 1,
            workRecords: 3,
          },
          generatedAt: '2026-06-21T00:00:00.000Z',
          omittedSensitiveFields: [
            'refresh token hashes',
            'external provider encrypted keys',
            'row payload contents',
          ],
          userId: 'user-1',
        }),
      loginWithGoogleAuthorizationCode:
        jest.fn<AuthService['loginWithGoogleAuthorizationCode']>(),
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
      validateAccountDeletionRequest:
        jest.fn<AuthService['validateAccountDeletionRequest']>(),
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
    metricsService = {
      recordRequest: jest.fn<MetricsService['recordRequest']>(),
      recordUserDataRights: jest.fn<MetricsService['recordUserDataRights']>(),
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
          provide: MetricsService,
          useValue: metricsService,
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

  it('exports authenticated server-side account data without provider secrets', async () => {
    const response = await fetch(`${baseUrl}/api/auth/data-export`, {
      headers: {
        authorization: 'Bearer access-token',
      },
      method: 'GET',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        counts: expect.objectContaining({
          externalApiCredentials: 1,
          workRecords: 1,
        }),
        omittedSensitiveFields: expect.arrayContaining([
          'refresh token hashes',
          'external provider encrypted keys',
        ]),
        user: expect.objectContaining({
          email: 'frieren@example.com',
        }),
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(
      /encryptedKey|authTag|tokenHash|previousTokenHash/i,
    );
    expect(authService.exportUserData).toHaveBeenCalledWith({
      email: 'frieren@example.com',
      role: 'user',
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.user_data.export',
        severity: 'info',
        userId: 'user-1',
      }),
    );
  });

  it('previews authenticated account deletion impact without row contents', async () => {
    const response = await fetch(
      `${baseUrl}/api/auth/account/deletion-preview`,
      {
        headers: {
          authorization: 'Bearer access-token',
        },
        method: 'GET',
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        anonymizedRecords: expect.objectContaining({
          securityEvents: 2,
        }),
        cascadeDeletedRecords: expect.objectContaining({
          authAccounts: 1,
          refreshSessions: 1,
          workRecords: 3,
        }),
        omittedSensitiveFields: expect.arrayContaining([
          'refresh token hashes',
          'row payload contents',
        ]),
        userId: 'user-1',
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(
      /"(encryptedKey|authTag|tokenHash|previousTokenHash|payload)"\s*:/i,
    );
    expect(authService.previewAccountDeletion).toHaveBeenCalledWith({
      email: 'frieren@example.com',
      role: 'user',
      sessionId: 'session-1',
      userId: 'user-1',
    });
  });

  it('deletes the authenticated server-side account after explicit confirmation', async () => {
    const response = await fetch(`${baseUrl}/api/auth/account`, {
      body: JSON.stringify({
        acknowledgeIrreversible: true,
        confirmEmail: 'frieren@example.com',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=refresh-token`,
      },
      method: 'DELETE',
    });
    const body = await response.json();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        deleted: true,
        userId: 'user-1',
        anonymizedRecords: expect.objectContaining({
          securityEvents: 2,
        }),
      }),
    );
    expect(authService.deleteAccount).toHaveBeenCalledWith(
      {
        email: 'frieren@example.com',
        role: 'user',
        sessionId: 'session-1',
        userId: 'user-1',
      },
      {
        acknowledgeIrreversible: true,
        confirmEmail: 'frieren@example.com',
      },
    );
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.account.delete',
        sessionId: 'session-1',
        severity: 'warning',
        userId: 'user-1',
      }),
    );
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('audits rejected account deletion confirmation without deleting the account', async () => {
    authService.validateAccountDeletionRequest.mockImplementationOnce(() => {
      throw new BadRequestException(
        'confirmEmail must match the current account email.',
      );
    });

    const response = await fetch(`${baseUrl}/api/auth/account`, {
      body: JSON.stringify({
        acknowledgeIrreversible: true,
        confirmEmail: 'fern@example.com',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'DELETE',
    });

    expect(response.status).toBe(400);
    expect(authService.deleteAccount).not.toHaveBeenCalled();
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.account.delete_failed',
        metadata: {
          reason: 'http_400',
        },
        sessionId: 'session-1',
        severity: 'warning',
        userId: 'user-1',
      }),
    );
    expect(securityAudit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.account.delete',
      }),
    );
    expect(metricsService.recordUserDataRights).toHaveBeenCalledWith({
      operation: 'delete',
      result: 'failure',
    });
  });

  it('audits account deletion service failures without double-counting controller metrics', async () => {
    authService.deleteAccount.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    const response = await fetch(`${baseUrl}/api/auth/account`, {
      body: JSON.stringify({
        acknowledgeIrreversible: true,
        confirmEmail: 'frieren@example.com',
      }),
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      method: 'DELETE',
    });

    expect(response.status).toBe(500);
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.account.delete',
        sessionId: 'session-1',
        severity: 'warning',
        userId: 'user-1',
      }),
    );
    expect(securityAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth.account.delete_failed',
        metadata: {
          reason: 'internal_error',
        },
        sessionId: 'session-1',
        severity: 'critical',
        userId: 'user-1',
      }),
    );
    expect(metricsService.recordUserDataRights).not.toHaveBeenCalled();
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

  it('clears the refresh cookie when refresh token validation fails', async () => {
    authService.refresh.mockRejectedValue(
      new UnauthorizedException('Invalid or expired refresh token.'),
    );

    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=expired-refresh-token`,
      },
      method: 'POST',
    });
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(401);
    expect(setCookie).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=;`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(authService.refresh).toHaveBeenCalledWith(
      'expired-refresh-token',
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
