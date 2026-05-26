import { type AddressInfo } from 'node:net';

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  type INestApplication,
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

import type { ApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { MetricsService } from '../src/observability/metrics.service';
import { SecurityAuditService } from '../src/security/security-audit.service';

@Controller('auth')
class TestAuthController {
  @Post('login')
  login(@Body() body: Record<string, unknown>) {
    return {
      email: body.email,
      ok: true,
    };
  }

  @Get('google/callback')
  googleCallback(@Query('state') state: string | undefined) {
    return {
      ok: true,
      state,
    };
  }

  @Post('refresh')
  refresh() {
    return {
      ok: true,
    };
  }

  @Post('logout')
  logout() {
    return {
      ok: true,
    };
  }
}

@Controller('sync')
class TestSyncController {
  @Post('push')
  push() {
    return {
      ok: true,
    };
  }
}

@Controller('imports')
class TestImportsController {
  @Get('search')
  search() {
    return {
      ok: true,
    };
  }

  @Post('resolve')
  resolve() {
    return {
      ok: true,
    };
  }
}

const baseConfig: ApiRuntimeConfig = {
  authRateLimitMax: 10,
  clientHeaderGuardMode: 'off',
  cookieSecure: false,
  corsOrigin: ['https://workarchive.example.com'],
  databaseUrl: 'postgresql://work:archive@localhost:5432/work_archive',
  googleOAuthClientId: null,
  googleOAuthClientSecret: null,
  googleOAuthRedirectUri: 'http://localhost:18730/api/auth/google/callback',
  host: '127.0.0.1',
  importAuthenticatedRateLimitMax: 60,
  importGuestRateLimitMax: 20,
  isProduction: false,
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  metricsBearerToken: null,
  metricsEnabled: false,
  port: 0,
  rateLimitPrefix: 'work-archive:test:',
  rateLimitStore: 'memory',
  rateLimitWindowMs: 60_000,
  redisUrl: null,
  securityEventHashSecret: 'test-security-event-hash-secret',
  swaggerEnabled: false,
  syncRateLimitMax: 10,
  trustProxyHops: null,
  webBaseUrl: 'https://workarchive.example.com',
};

describe('app security middleware', () => {
  let app: INestApplication;
  let baseUrl: string;
  let securityAudit: {
    record: jest.MockedFunction<SecurityAuditService['record']>;
  };

  afterEach(async () => {
    await app?.close();
  });

  async function startApp(config: ApiRuntimeConfig) {
    securityAudit = {
      record: jest.fn<SecurityAuditService['record']>().mockResolvedValue(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        TestAuthController,
        TestImportsController,
        TestSyncController,
      ],
      providers: [
        {
          provide: SecurityAuditService,
          useValue: securityAudit,
        },
        {
          provide: MetricsService,
          useValue: {
            recordRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureApp(app, config);
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function postLogin(headers: Record<string, string> = {}) {
    return fetch(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({
        email: 'frieren@example.com',
      }),
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      method: 'POST',
    });
  }

  describe('production origin guard', () => {
    beforeEach(async () => {
      await startApp({
        ...baseConfig,
        isProduction: true,
        trustProxyHops: 1,
      });
    });

    it('blocks unsafe production requests without an allowed Origin', async () => {
      await expect(postLogin()).resolves.toEqual(
        expect.objectContaining({
          status: 403,
        }),
      );

      await expect(
        postLogin({
          origin: 'https://evil.example.com',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 403,
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.origin_blocked',
          severity: 'warning',
        }),
      );
    });

    it('allows unsafe production requests from whitelisted origins', async () => {
      await expect(
        postLogin({
          origin: 'https://workarchive.example.com',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
    });

    it('blocks cross-site unsafe requests with Fetch Metadata before Origin fallback', async () => {
      const response = await postLogin({
        origin: 'https://workarchive.example.com',
        'sec-fetch-site': 'cross-site',
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Cross-site unsafe requests are not allowed.',
          statusCode: 403,
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.fetch_metadata_blocked',
          metadata: expect.objectContaining({
            secFetchSite: 'cross-site',
          }),
          severity: 'warning',
        }),
      );
    });

    it('allows same-origin unsafe requests with Fetch Metadata even when Origin is absent', async () => {
      await expect(
        postLogin({
          'sec-fetch-site': 'same-origin',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
    });

    it('checks same-site unsafe request origins when Fetch Metadata is present', async () => {
      await expect(
        postLogin({
          origin: 'https://workarchive.example.com',
          'sec-fetch-site': 'same-site',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );

      const response = await postLogin({
        origin: 'https://evil.example.com',
        'sec-fetch-site': 'same-site',
      });

      expect(response.status).toBe(403);
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.origin_blocked',
          metadata: expect.objectContaining({
            origin: 'https://evil.example.com',
          }),
          severity: 'warning',
        }),
      );
    });

    it('blocks same-site unsafe requests without Origin instead of trusting Fetch Metadata alone', async () => {
      const response = await postLogin({
        'sec-fetch-site': 'same-site',
      });

      expect(response.status).toBe(403);
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.origin_blocked',
          metadata: expect.objectContaining({
            origin: 'missing',
          }),
          severity: 'warning',
        }),
      );
    });

    it('checks user-initiated none unsafe request origins and blocks missing Origin', async () => {
      await expect(
        postLogin({
          origin: 'https://workarchive.example.com',
          'sec-fetch-site': 'none',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );

      await expect(
        postLogin({
          'sec-fetch-site': 'none',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 403,
        }),
      );
    });

    it('keeps OAuth top-level GET callback flows outside unsafe CSRF blocking', async () => {
      await expect(
        fetch(`${baseUrl}/api/auth/google/callback?state=test-state`, {
          headers: {
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'cross-site',
          },
          method: 'GET',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
        }),
      );
    });
  });

  describe('production client header guard', () => {
    async function postSyncPush(headers: Record<string, string> = {}) {
      return fetch(`${baseUrl}/api/sync/push`, {
        headers: {
          authorization: 'Bearer test-token',
          'sec-fetch-site': 'same-origin',
          ...headers,
        },
        method: 'POST',
      });
    }

    it('audits authenticated unsafe requests with a missing client header in audit mode', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'audit',
        isProduction: true,
        trustProxyHops: 1,
      });

      await expect(postSyncPush()).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.client_header_missing',
          metadata: expect.objectContaining({
            hasAuthorization: true,
            headerValue: 'missing',
            mode: 'audit',
          }),
          severity: 'warning',
        }),
      );
    });

    it('blocks authenticated unsafe requests with a missing client header in enforce mode', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'enforce',
        isProduction: true,
        trustProxyHops: 1,
      });

      const response = await postSyncPush();

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Required client header is missing.',
          statusCode: 403,
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.client_header_missing',
          metadata: expect.objectContaining({
            mode: 'enforce',
          }),
          severity: 'warning',
        }),
      );
    });

    it('allows authenticated unsafe requests with the expected client header in enforce mode', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'enforce',
        isProduction: true,
        trustProxyHops: 1,
      });

      await expect(
        postSyncPush({
          'x-work-archive-client': 'web',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
    });

    it('does not require the client header for refresh, OAuth callback, or bearerless logout flows', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'enforce',
        isProduction: true,
        trustProxyHops: 1,
      });

      await expect(
        fetch(`${baseUrl}/api/auth/refresh`, {
          headers: {
            'sec-fetch-site': 'same-origin',
          },
          method: 'POST',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
      await expect(
        fetch(`${baseUrl}/api/auth/logout`, {
          headers: {
            'sec-fetch-site': 'same-origin',
          },
          method: 'POST',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
      await expect(
        fetch(`${baseUrl}/api/auth/google/callback?state=test-state`, {
          headers: {
            'sec-fetch-site': 'cross-site',
          },
          method: 'GET',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
        }),
      );
    });
  });

  describe('auth rate limit', () => {
    beforeEach(async () => {
      await startApp({
        ...baseConfig,
        authRateLimitMax: 2,
      });
    });

    it('returns 429 after the configured auth limit', async () => {
      expect((await postLogin()).status).toBe(201);
      expect((await postLogin()).status).toBe(201);
      expect((await postLogin()).status).toBe(429);
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          severity: 'warning',
        }),
      );
    });
  });

  describe('endpoint rate limit buckets', () => {
    beforeEach(async () => {
      await startApp({
        ...baseConfig,
        authRateLimitMax: 1,
        importAuthenticatedRateLimitMax: 1,
        importGuestRateLimitMax: 1,
        syncRateLimitMax: 1,
      });
    });

    it('keeps auth, sync, and provider search/import limits in separate buckets', async () => {
      expect((await postLogin()).status).toBe(201);
      expect((await postLogin()).status).toBe(429);

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            method: 'POST',
          })
        ).status,
      ).toBe(429);

      expect((await fetch(`${baseUrl}/api/imports/search?q=dune`)).status).toBe(
        200,
      );
      expect((await fetch(`${baseUrl}/api/imports/search?q=dune`)).status).toBe(
        429,
      );

      expect(
        (
          await fetch(`${baseUrl}/api/imports/resolve`, {
            headers: {
              authorization: 'Bearer test-token',
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/resolve`, {
            headers: {
              authorization: 'Bearer test-token',
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);

      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'auth',
          }),
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'sync',
          }),
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'imports_guest',
          }),
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'imports_authenticated',
          }),
        }),
      );
    });

    it('separates guest and authenticated provider search limits', async () => {
      expect((await fetch(`${baseUrl}/api/imports/search?q=dune`)).status).toBe(
        200,
      );
      expect((await fetch(`${baseUrl}/api/imports/search?q=dune`)).status).toBe(
        429,
      );
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer test-token',
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer test-token',
            },
          })
        ).status,
      ).toBe(429);
    });
  });
});
