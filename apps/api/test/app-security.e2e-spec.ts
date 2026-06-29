import { type AddressInfo } from 'node:net';

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { IsEmail } from 'class-validator';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import jwt from 'jsonwebtoken';

import type { ApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { MetricsService } from '../src/observability/metrics.service';
import { SecurityAuditService } from '../src/security/security-audit.service';
import { shouldApplyApiNoStore } from '../src/security/security-middleware';

class TestLoginDto {
  @IsEmail()
  email!: string;
}

@Controller('auth')
class TestAuthController {
  @Post('login')
  login(@Body() body: TestLoginDto) {
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

  @Get('data-export')
  dataExport() {
    return {
      ok: true,
    };
  }

  @Get('account/deletion-preview')
  deletionPreview() {
    return {
      ok: true,
    };
  }

  @Delete('account')
  deleteAccount() {
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

@Controller('catalog')
class TestCatalogController {
  @Get('search')
  search() {
    return {
      ok: true,
    };
  }

  @Post('submissions')
  submit() {
    return {
      ok: true,
    };
  }
}

@Controller('works')
class TestWorksController {
  @Get()
  list() {
    return {
      ok: true,
    };
  }

  @Post()
  create() {
    return {
      ok: true,
    };
  }
}

@Controller('user-records')
class TestUserRecordsController {
  @Post()
  create() {
    return {
      ok: true,
    };
  }
}

@Controller()
class TestHealthController {
  @Get('health')
  health() {
    return {
      ok: true,
    };
  }

  @Get('livez')
  livez() {
    return {
      ok: true,
    };
  }

  @Get('readyz')
  readyz() {
    return {
      ok: true,
    };
  }

  @Get('error/bad-request')
  badRequest() {
    throw new BadRequestException('Known bad request.');
  }

  @Get('error/internal')
  internalError() {
    throw new Error('database password leaked in an internal stack');
  }
}

const baseConfig: ApiRuntimeConfig = {
  authRateLimitMax: 10,
  authSensitiveRateLimitMax: 5,
  catalogRateLimitMax: 20,
  globalRateLimitMax: 600,
  clientHeaderGuardMode: 'off',
  cookieSecure: false,
  corsOrigin: ['https://workarchive.example.com'],
  databaseUrl: 'postgresql://work:archive@localhost:5432/work_archive',
  googleOAuthClientId: null,
  googleOAuthClientSecret: null,
  googleOAuthRedirectUri: 'http://localhost:18730/api/auth/google/callback',
  headersTimeoutMs: 15_000,
  host: '127.0.0.1',
  importAuthenticatedRateLimitMax: 60,
  importGuestRateLimitMax: 20,
  imageProxyRateLimitMax: 120,
  isProduction: false,
  jsonBodyLimit: '2mb',
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  keepAliveTimeoutMs: 5_000,
  logLevel: 'info',
  metricsBearerToken: null,
  metricsEnabled: false,
  mutationRateLimitMax: 120,
  notionRateLimitMax: 20,
  port: 0,
  rateLimitPrefix: 'work-archive:test:',
  rateLimitStore: 'memory',
  rateLimitWindowMs: 60_000,
  readinessCheckTimeoutMs: 1500,
  redisUrl: null,
  requestTimeoutMs: 120_000,
  securityEventHashSecret: 'test-security-event-hash-secret',
  swaggerEnabled: false,
  syncRateLimitMax: 10,
  trustProxyHops: null,
  urlencodedBodyLimit: '64kb',
  webBaseUrl: 'https://workarchive.example.com',
};

describe('app security middleware', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let securityAudit: {
    record: jest.MockedFunction<SecurityAuditService['record']>;
  };
  let metricsService: {
    recordClientHeaderGuard: jest.Mock;
    recordRateLimitExceeded: jest.Mock;
    recordRequest: jest.Mock;
  };

  afterEach(async () => {
    await app?.close();
  });

  async function startApp(config: ApiRuntimeConfig) {
    securityAudit = {
      record: jest.fn<SecurityAuditService['record']>().mockResolvedValue(),
    };
    metricsService = {
      recordClientHeaderGuard: jest.fn(),
      recordRateLimitExceeded: jest.fn(),
      recordRequest: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [
        TestAuthController,
        TestCatalogController,
        TestHealthController,
        TestImportsController,
        TestSyncController,
        TestUserRecordsController,
        TestWorksController,
      ],
      providers: [
        {
          provide: SecurityAuditService,
          useValue: securityAudit,
        },
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    app.useBodyParser('json', { limit: config.jsonBodyLimit });
    app.useBodyParser('urlencoded', {
      extended: false,
      limit: config.urlencodedBodyLimit,
    });
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

  function buildAccessToken(userId: string, sessionId: string) {
    return jwt.sign(
      {
        email: `${userId}@example.com`,
        sid: sessionId,
        sub: userId,
        type: 'access',
      },
      baseConfig.jwtAccessSecret,
      {
        algorithm: 'HS256',
        audience: 'work-archive-web',
        expiresIn: 60 * 15,
        issuer: 'work-archive-api',
        jwtid: `${userId}-${sessionId}-test-token`,
      },
    );
  }

  describe('request id middleware', () => {
    beforeEach(async () => {
      await startApp(baseConfig);
    });

    it('echoes a valid client request id', async () => {
      const response = await postLogin({
        'x-request-id': 'req_123-abc.def:456',
      });

      expect(response.headers.get('x-request-id')).toBe('req_123-abc.def:456');
    });

    it('replaces an invalid client request id with a generated UUID', async () => {
      const response = await postLogin({
        'x-request-id': 'invalid request id',
      });
      const requestId = response.headers.get('x-request-id');

      expect(requestId).not.toBe('invalid request id');
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('API cache control', () => {
    beforeEach(async () => {
      await startApp(baseConfig);
    });

    it('marks API responses as no-store by default', async () => {
      const authResponse = await postLogin();
      const importResponse = await fetch(`${baseUrl}/api/imports/search?q=dune`);

      expect(authResponse.headers.get('cache-control')).toBe('no-store');
      expect(importResponse.headers.get('cache-control')).toBe('no-store');
    });

    it('marks operational health responses as no-store', async () => {
      const healthResponse = await fetch(`${baseUrl}/health`);
      const livenessResponse = await fetch(`${baseUrl}/livez`);
      const readinessResponse = await fetch(`${baseUrl}/readyz`);

      expect(healthResponse.headers.get('cache-control')).toBe('no-store');
      expect(livenessResponse.headers.get('cache-control')).toBe('no-store');
      expect(readinessResponse.headers.get('cache-control')).toBe('no-store');
    });

    it('does not override the public image proxy cache policy', () => {
      expect(shouldApplyApiNoStore('/api/image-proxy?url=https://example.com/a.jpg')).toBe(
        false,
      );
      expect(shouldApplyApiNoStore('/api/auth/me')).toBe(true);
      expect(shouldApplyApiNoStore('/health')).toBe(true);
      expect(shouldApplyApiNoStore('/livez')).toBe(true);
      expect(shouldApplyApiNoStore('/readyz')).toBe(true);
    });
  });

  describe('API input validation', () => {
    beforeEach(async () => {
      await startApp(baseConfig);
    });

    it('rejects overlong request targets before controller handling without echoing query data', async () => {
      const longQueryValue = `raw-token-${'a'.repeat(8_300)}`;
      const response = await fetch(
        `${baseUrl}/api/imports/search?q=${longQueryValue}`,
        {
          headers: {
            'x-request-id': 'req_long_target_1',
          },
        },
      );
      const body = await response.json();

      expect(response.status).toBe(414);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe('req_long_target_1');
      expect(body).toEqual(
        expect.objectContaining({
          error: 'URI Too Long',
          message: 'Request target is too long.',
          requestId: 'req_long_target_1',
          statusCode: 414,
        }),
      );
      expect(JSON.stringify(body)).not.toContain(longQueryValue);
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.request_target_too_long',
          metadata: expect.objectContaining({
            limit: 8192,
            method: 'GET',
            path: '/api/imports/search',
            targetLength: expect.any(Number),
          }),
          severity: 'warning',
        }),
      );
    });

    it('returns sanitized JSON for malformed request bodies before validation', async () => {
      const rawBody = '{"email":"raw-token-secret"';
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        body: rawBody,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_malformed_body_1',
        },
        method: 'POST',
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(
        'req_malformed_body_1',
      );
      expect(body).toEqual(
        expect.objectContaining({
          error: 'Bad Request',
          message: 'Malformed request body.',
          requestId: 'req_malformed_body_1',
          statusCode: 400,
        }),
      );
      expect(JSON.stringify(body)).not.toContain('raw-token-secret');
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.request_body_rejected',
          metadata: expect.objectContaining({
            bodyErrorType: 'entity.parse.failed',
            method: 'POST',
            path: '/api/auth/login',
            statusCode: 400,
          }),
          severity: 'warning',
        }),
      );
    });

    it('returns sanitized JSON for oversized request bodies before validation', async () => {
      await app.close();
      await startApp({
        ...baseConfig,
        jsonBodyLimit: '1kb',
      });

      const rawBody = JSON.stringify({
        email: `${'raw-token-secret'.repeat(120)}@example.com`,
      });
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        body: rawBody,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_large_body_1',
        },
        method: 'POST',
      });
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe('req_large_body_1');
      expect(body).toEqual(
        expect.objectContaining({
          error: 'Payload Too Large',
          message: 'Request body is too large.',
          requestId: 'req_large_body_1',
          statusCode: 413,
        }),
      );
      expect(JSON.stringify(body)).not.toContain('raw-token-secret');
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.request_body_rejected',
          metadata: expect.objectContaining({
            bodyErrorType: 'entity.too.large',
            method: 'POST',
            path: '/api/auth/login',
            statusCode: 413,
          }),
          severity: 'warning',
        }),
      );
    });

    it('rejects unsupported request body media types before validation', async () => {
      const rawBody = 'raw-token-secret=frieren@example.com';
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        body: rawBody,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-request-id': 'req_unsupported_media_1',
        },
        method: 'POST',
      });
      const body = await response.json();

      expect(response.status).toBe(415);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(
        'req_unsupported_media_1',
      );
      expect(body).toEqual(
        expect.objectContaining({
          error: 'Unsupported Media Type',
          message: 'Unsupported request body media type.',
          requestId: 'req_unsupported_media_1',
          statusCode: 415,
        }),
      );
      expect(JSON.stringify(body)).not.toContain('raw-token-secret');
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.unsupported_media_type',
          metadata: expect.objectContaining({
            contentType: 'text/plain',
            method: 'POST',
            path: '/api/auth/login',
            statusCode: 415,
          }),
          severity: 'warning',
        }),
      );
    });

    it('allows unsafe API requests without request bodies to omit content type', async () => {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        headers: {
          'x-request-id': 'req_no_body_content_type_1',
        },
        method: 'POST',
      });

      expect(response.status).toBe(201);
      expect(securityAudit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.unsupported_media_type',
        }),
      );
    });

    it('rejects unknown body fields instead of silently stripping them', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        body: JSON.stringify({
          email: 'frieren@example.com',
          role: 'admin',
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: expect.arrayContaining([
            'property role should not exist',
          ]),
          statusCode: 400,
        }),
      );
    });

    it('does not echo invalid DTO values in validation errors', async () => {
      const invalidEmail = 'raw-token-secret-not-an-email';
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        body: JSON.stringify({
          email: invalidEmail,
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          message: expect.arrayContaining(['email must be an email']),
          statusCode: 400,
        }),
      );
      expect(JSON.stringify(body)).not.toContain(invalidEmail);
    });
  });

  describe('API error responses', () => {
    beforeEach(async () => {
      await startApp(baseConfig);
    });

    it('adds request ids to expected HTTP exception responses', async () => {
      const response = await fetch(`${baseUrl}/api/error/bad-request`, {
        headers: {
          'x-request-id': 'req_expected_error_1',
        },
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: 'Bad Request',
          message: 'Known bad request.',
          requestId: 'req_expected_error_1',
          statusCode: 400,
        }),
      );
    });

    it('sanitizes unhandled runtime errors without leaking stack details', async () => {
      const response = await fetch(`${baseUrl}/api/error/internal`, {
        headers: {
          'x-request-id': 'req_runtime_error_1',
        },
      });

      expect(response.status).toBe(500);
      const body = await response.json();

      expect(body).toEqual(
        expect.objectContaining({
          error: 'Internal Server Error',
          message: 'Internal server error.',
          requestId: 'req_runtime_error_1',
          statusCode: 500,
        }),
      );
      expect(JSON.stringify(body)).not.toContain('database password');
      expect(JSON.stringify(body)).not.toContain('stack');
    });
  });

  describe('API security headers', () => {
    beforeEach(async () => {
      await startApp(baseConfig);
    });

    it('sends the API security header baseline', async () => {
      const response = await fetch(`${baseUrl}/api/imports/search?q=dune`);
      const contentSecurityPolicy =
        response.headers.get('content-security-policy') ?? '';

      expect(response.headers.get('x-powered-by')).toBeNull();
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('strict-transport-security')).toContain(
        'max-age=31536000',
      );
      expect(contentSecurityPolicy).toContain("default-src 'none'");
      expect(contentSecurityPolicy).toContain("base-uri 'none'");
      expect(contentSecurityPolicy).toContain("form-action 'none'");
      expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
      expect(contentSecurityPolicy).toContain("object-src 'none'");
    });
  });

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

      const blockedOriginResponse = await postLogin({
        origin: 'https://evil.example.com',
        'x-request-id': 'req_origin_blocked_1',
      });

      expect(blockedOriginResponse.status).toBe(403);
      await expect(blockedOriginResponse.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Origin is not allowed.',
          requestId: 'req_origin_blocked_1',
          statusCode: 403,
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

    it('uses explicit CORS preflight methods and request headers for allowed origins', async () => {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          'access-control-request-headers':
            'Authorization, Content-Type, X-Request-Id, X-Work-Archive-Client',
          'access-control-request-method': 'PATCH',
          origin: 'https://workarchive.example.com',
        },
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(
        'https://workarchive.example.com',
      );
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true',
      );
      expect(response.headers.get('access-control-max-age')).toBe('600');
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      expect(response.headers.get('access-control-allow-methods')).not.toContain(
        'TRACE',
      );
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'Authorization,Content-Type,X-Request-Id,X-Work-Archive-Client',
      );
      expect(response.headers.get('access-control-expose-headers')).toBe(
        'X-Request-Id',
      );
    });

    it('blocks cross-site unsafe requests with Fetch Metadata before Origin fallback', async () => {
      const response = await postLogin({
        origin: 'https://workarchive.example.com',
        'sec-fetch-site': 'cross-site',
        'x-request-id': 'req_fetch_metadata_blocked_1',
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Cross-site unsafe requests are not allowed.',
          requestId: 'req_fetch_metadata_blocked_1',
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
      expect(metricsService.recordClientHeaderGuard).toHaveBeenCalledWith({
        method: 'POST',
        mode: 'audit',
        result: 'missing',
      });
    });

    it('blocks authenticated unsafe requests with a missing client header in enforce mode', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'enforce',
        isProduction: true,
        trustProxyHops: 1,
      });

      const response = await postSyncPush({
        'x-request-id': 'req_client_header_missing_1',
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          message: 'Required client header is missing.',
          requestId: 'req_client_header_missing_1',
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
      expect(metricsService.recordClientHeaderGuard).toHaveBeenCalledWith({
        method: 'POST',
        mode: 'enforce',
        result: 'missing',
      });
    });

    it('does not treat malformed bearer headers as authenticated for the client header guard', async () => {
      await startApp({
        ...baseConfig,
        clientHeaderGuardMode: 'enforce',
        isProduction: true,
        trustProxyHops: 1,
      });

      const response = await fetch(`${baseUrl}/api/sync/push`, {
        headers: {
          authorization: 'Bearer  test-token',
          'sec-fetch-site': 'same-origin',
        },
        method: 'POST',
      });

      expect(response.status).toBe(201);
      expect(securityAudit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.client_header_missing',
        }),
      );
      expect(metricsService.recordClientHeaderGuard).not.toHaveBeenCalled();
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
      expect(metricsService.recordClientHeaderGuard).toHaveBeenCalledWith({
        method: 'POST',
        mode: 'enforce',
        result: 'accepted',
      });
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

  describe('sensitive auth operation rate limit', () => {
    beforeEach(async () => {
      await startApp({
        ...baseConfig,
        authRateLimitMax: 20,
        authSensitiveRateLimitMax: 1,
      });
    });

    it('uses a stricter bucket for account data export and deletion endpoints', async () => {
      expect((await fetch(`${baseUrl}/api/auth/data-export`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/auth/data-export`)).status).toBe(429);
      expect(
        (await fetch(`${baseUrl}/api/auth/account/deletion-preview`)).status,
      ).toBe(429);
      expect(
        (
          await fetch(`${baseUrl}/api/auth/account`, {
            method: 'DELETE',
          })
        ).status,
      ).toBe(429);

      expect((await postLogin()).status).toBe(201);

      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'auth_sensitive',
          }),
          severity: 'warning',
        }),
      );
      expect(metricsService.recordRateLimitExceeded).toHaveBeenCalledWith(
        'auth_sensitive',
      );
    });
  });

  describe('endpoint rate limit buckets', () => {
    beforeEach(async () => {
      await startApp({
        ...baseConfig,
        authRateLimitMax: 1,
        authSensitiveRateLimitMax: 1,
        catalogRateLimitMax: 1,
        importAuthenticatedRateLimitMax: 1,
        importGuestRateLimitMax: 1,
        mutationRateLimitMax: 1,
        syncRateLimitMax: 1,
      });
    });

    it('keeps auth, catalog, mutation, sync, and provider search/import limits in separate buckets', async () => {
      expect((await postLogin()).status).toBe(201);
      expect((await postLogin()).status).toBe(429);

      expect(
        (await fetch(`${baseUrl}/api/catalog/search?q=dune`)).status,
      ).toBe(200);
      expect(
        (await fetch(`${baseUrl}/api/catalog/search?q=dune`)).status,
      ).toBe(429);

      expect(
        (
          await fetch(`${baseUrl}/api/works`, {
            method: 'GET',
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/works`, {
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/user-records`, {
            method: 'POST',
          })
        ).status,
      ).toBe(429);

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
            limiter: 'mutations',
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
            limiter: 'catalog',
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
            limiter: 'imports_protected',
          }),
        }),
      );
    });

    it('keys authenticated sync limits by verified user session instead of shared IP', async () => {
      const firstUserToken = buildAccessToken('user-1', 'session-1');
      const secondUserToken = buildAccessToken('user-2', 'session-2');

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer  ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
    });

    it('does not trust non-HS256 access tokens for authenticated rate-limit keys', async () => {
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          sid: 'session-1',
          sub: 'user-1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS384',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'second@example.com',
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS384',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('does not trust access tokens missing required registered claims for authenticated rate-limit keys', async () => {
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          sid: 'session-1',
          sub: 'user-1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'second@example.com',
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('does not trust access tokens with refresh-only claims for authenticated rate-limit keys', async () => {
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          rememberMe: true,
          sid: 'session-1',
          sub: 'user-1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
          jwtid: 'access-token-with-remember-me-1',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'second@example.com',
          rememberMe: false,
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
          jwtid: 'access-token-with-remember-me-2',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('does not trust access tokens with unsafe identity claims for authenticated rate-limit keys', async () => {
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          sid: 'session-1',
          sub: 'user:1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
          jwtid: 'access-token-with-unsafe-subject',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'invalid email',
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 15,
          issuer: 'work-archive-api',
          jwtid: 'access-token-with-unsafe-email',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('does not trust long-lived access tokens for authenticated rate-limit keys', async () => {
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          sid: 'session-1',
          sub: 'user-1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 60,
          issuer: 'work-archive-api',
          jwtid: 'long-lived-access-token-1',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'second@example.com',
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          expiresIn: 60 * 60,
          issuer: 'work-archive-api',
          jwtid: 'long-lived-access-token-2',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('does not trust future-issued access tokens for authenticated rate-limit keys', async () => {
      const issuedAt = Math.floor(Date.now() / 1000) + 60 * 10;
      const firstUserToken = jwt.sign(
        {
          email: 'first@example.com',
          exp: issuedAt + 60 * 15,
          iat: issuedAt,
          sid: 'session-1',
          sub: 'user-1',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          issuer: 'work-archive-api',
          jwtid: 'future-issued-access-token-1',
        },
      );
      const secondUserToken = jwt.sign(
        {
          email: 'second@example.com',
          exp: issuedAt + 60 * 15,
          iat: issuedAt,
          sid: 'session-2',
          sub: 'user-2',
          type: 'access',
        },
        baseConfig.jwtAccessSecret,
        {
          algorithm: 'HS256',
          audience: 'work-archive-web',
          issuer: 'work-archive-api',
          jwtid: 'future-issued-access-token-2',
        },
      );

      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${firstUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/sync/push`, {
            headers: {
              authorization: `Bearer ${secondUserToken}`,
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
    });

    it('separates guest and authenticated provider search limits', async () => {
      const accessToken = buildAccessToken('user-1', 'session-1');

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
              authorization: `Bearer ${accessToken}`,
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          })
        ).status,
      ).toBe(429);
    });

    it('counts malformed provider search bearer headers against the guest limiter', async () => {
      const accessToken = buildAccessToken('user-1', 'session-1');

      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer test-token extra',
            },
          })
        ).status,
      ).toBe(200);
      expect((await fetch(`${baseUrl}/api/imports/search?q=dune`)).status).toBe(
        429,
      );
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          })
        ).status,
      ).toBe(429);
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

    it('counts invalid provider search bearer tokens against the guest limiter', async () => {
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer syntactically-valid-but-not-signed',
            },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer another-invalid-token',
            },
          })
        ).status,
      ).toBe(429);

      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'imports_guest',
          }),
        }),
      );
      expect(metricsService.recordRateLimitExceeded).toHaveBeenCalledWith(
        'imports_guest',
      );
      expect(metricsService.recordRateLimitExceeded).not.toHaveBeenCalledWith(
        'imports_authenticated',
      );
    });

    it('rate limits protected import resolve attempts before authentication succeeds', async () => {
      expect(
        (
          await fetch(`${baseUrl}/api/imports/resolve`, {
            method: 'POST',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/resolve`, {
            headers: {
              authorization: 'Bearer test-token extra',
            },
            method: 'POST',
          })
        ).status,
      ).toBe(429);
      expect(
        (
          await fetch(`${baseUrl}/api/imports/search?q=dune`, {
            headers: {
              authorization: 'Bearer test-token',
            },
          })
        ).status,
      ).toBe(200);
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'imports_protected',
          }),
        }),
      );
      expect(metricsService.recordRateLimitExceeded).toHaveBeenCalledWith(
        'imports_protected',
      );
    });
  });

  describe('global API rate limit', () => {
    it('applies a global limiter across API routes before route-specific limits', async () => {
      await startApp({
        ...baseConfig,
        authRateLimitMax: 10,
        globalRateLimitMax: 2,
        rateLimitWindowMs: 60_000,
      });

      await expect(postLogin()).resolves.toEqual(
        expect.objectContaining({
          status: 201,
        }),
      );
      await expect(
        fetch(`${baseUrl}/api/imports/search`, {
          method: 'GET',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
        }),
      );

      const response = await fetch(`${baseUrl}/api/sync/push`, {
        headers: {
          'x-request-id': 'req_global_rate_limit_1',
        },
        method: 'POST',
      });

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: 'Too Many Requests',
          requestId: 'req_global_rate_limit_1',
          statusCode: 429,
        }),
      );
      expect(securityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'http.rate_limit_exceeded',
          metadata: expect.objectContaining({
            limiter: 'global',
          }),
        }),
      );
      expect(metricsService.recordRateLimitExceeded).toHaveBeenCalledWith(
        'global',
      );
    });
  });
});
