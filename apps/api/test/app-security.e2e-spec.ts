import { type AddressInfo } from 'node:net';

import { Body, Controller, Post, type INestApplication } from '@nestjs/common';
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
}

const baseConfig: ApiRuntimeConfig = {
  authRateLimitMax: 10,
  cookieSecure: false,
  corsOrigin: ['https://workarchive.example.com'],
  databaseUrl: 'postgresql://work:archive@localhost:5432/work_archive',
  googleOAuthClientId: null,
  googleOAuthClientSecret: null,
  googleOAuthRedirectUri: 'http://localhost:3000/api/auth/google/callback',
  host: '127.0.0.1',
  importAuthenticatedRateLimitMax: 60,
  importGuestRateLimitMax: 20,
  isProduction: false,
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
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
      controllers: [TestAuthController],
      providers: [
        {
          provide: SecurityAuditService,
          useValue: securityAudit,
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
});
