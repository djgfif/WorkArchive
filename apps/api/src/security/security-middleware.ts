import { Logger } from '@nestjs/common';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import rateLimit, {
  ipKeyGenerator,
  type Options,
  type Store,
} from 'express-rate-limit';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { randomUUID } from 'node:crypto';

import { connectRedisClient, type RedisClient } from '../common/redis-client';
import type { ApiRuntimeConfig } from '../config/api-runtime-config';
import {
  AUTH_JWT_ALGORITHM,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  hasExpectedAuthIdentityClaims,
  hasExpectedAuthTemporalClaims,
  hasExpectedAuthTokenKindClaims,
  hasRequiredAuthJwtClaims,
  type AuthTokenPayload,
} from '../modules/auth/auth.types';
import type { MetricsService } from '../observability/metrics.service';
import { normalizeRequestId } from './request-id';
import type { SecurityAuditService } from './security-audit.service';
import { setRequestId } from './security-audit.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SUPPORTED_API_BODY_MEDIA_TYPES = new Set([
  'application/json',
  'application/x-www-form-urlencoded',
]);
const WORK_ARCHIVE_CLIENT_HEADER = 'x-work-archive-client';
const WORK_ARCHIVE_CLIENT_HEADER_VALUE = 'web';
const RATE_LIMIT_REDIS_SHUTDOWN_TIMEOUT_MS = 3_000;
export const MAXIMUM_REQUEST_TARGET_LENGTH = 8_192;
const NO_STORE_OPERATIONAL_PATHS = new Set(['/health', '/livez', '/readyz']);
const VERIFIED_ACCESS_TOKEN_PAYLOAD = Symbol(
  'workArchiveVerifiedAccessTokenPayload',
);
const redisClients: RedisClient[] = [];

type RequestWithVerifiedAccessTokenPayload = Request & {
  [VERIFIED_ACCESS_TOKEN_PAYLOAD]?: AuthTokenPayload | null;
};

type SecurityJsonError =
  | 'Forbidden'
  | 'Too Many Requests'
  | 'URI Too Long'
  | 'Unsupported Media Type';

export function createProductionFetchMetadataGuard(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!config.isProduction || SAFE_METHODS.has(request.method)) {
      next();

      return;
    }

    const fetchSite = request.header('sec-fetch-site')?.trim().toLowerCase();

    if (!fetchSite) {
      next();

      return;
    }

    if (fetchSite !== 'cross-site') {
      next();

      return;
    }

    void securityAudit.record({
      eventType: 'http.fetch_metadata_blocked',
      metadata: {
        method: request.method,
        path: request.path,
        secFetchSite: fetchSite,
      },
      request,
      severity: 'warning',
    });

    sendSecurityJsonError(request, response, {
      message: 'Cross-site unsafe requests are not allowed.',
      error: 'Forbidden',
      statusCode: 403,
    });
  };
}

export function createProductionOriginGuard(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
) {
  const allowedOrigins = new Set(config.corsOrigin);

  return (request: Request, response: Response, next: NextFunction) => {
    const fetchSite = request.header('sec-fetch-site')?.trim().toLowerCase();

    if (!config.isProduction || SAFE_METHODS.has(request.method)) {
      next();

      return;
    }

    if (fetchSite === 'same-origin') {
      next();

      return;
    }

    // same-site and none still need an Origin allowlist check when present.
    // If Origin is absent, keep the conservative fallback and block the unsafe
    // request; same-origin browser API calls should carry Sec-Fetch-Site:
    // same-origin and are handled above.

    const origin = request.header('origin');

    if (origin && allowedOrigins.has(origin)) {
      next();

      return;
    }

    void securityAudit.record({
      eventType: 'http.origin_blocked',
      metadata: {
        method: request.method,
        origin: origin ?? 'missing',
        path: request.path,
      },
      request,
      severity: 'warning',
    });

    sendSecurityJsonError(request, response, {
      message: 'Origin is not allowed.',
      error: 'Forbidden',
      statusCode: 403,
    });
  };
}

export function createProductionClientHeaderGuard(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
  metricsService?: Pick<MetricsService, 'recordClientHeaderGuard'>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (
      !config.isProduction ||
      config.clientHeaderGuardMode === 'off' ||
      SAFE_METHODS.has(request.method) ||
      !hasBearerAuthorization(request)
    ) {
      next();

      return;
    }

    const headerValue = request
      .header(WORK_ARCHIVE_CLIENT_HEADER)
      ?.trim()
      .toLowerCase();

    if (headerValue === WORK_ARCHIVE_CLIENT_HEADER_VALUE) {
      metricsService?.recordClientHeaderGuard({
        method: request.method,
        mode: config.clientHeaderGuardMode,
        result: 'accepted',
      });
      next();

      return;
    }

    metricsService?.recordClientHeaderGuard({
      method: request.method,
      mode: config.clientHeaderGuardMode,
      result: 'missing',
    });

    void securityAudit.record({
      eventType: 'http.client_header_missing',
      metadata: {
        hasAuthorization: true,
        headerValue: headerValue || 'missing',
        method: request.method,
        mode: config.clientHeaderGuardMode,
        path: request.path,
      },
      request,
      severity: 'warning',
    });

    if (config.clientHeaderGuardMode === 'audit') {
      next();

      return;
    }

    sendSecurityJsonError(request, response, {
      message: 'Required client header is missing.',
      error: 'Forbidden',
      statusCode: 403,
    });
  };
}

function hasBearerAuthorization(request: Request) {
  const authorization = request.header('authorization');

  return /^Bearer ([^\s]+)$/.test(authorization ?? '');
}

export function createRequestIdMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestId = ensureRequestId(request);
    setRequestId(request, requestId);
    response.setHeader('x-request-id', requestId);
    next();
  };
}

function ensureRequestId(request: Request) {
  const requestWithLoggerId = request as Request & {
    id?: string;
  };

  return (
    normalizeRequestId(request.header('x-request-id')) ||
    normalizeRequestId(requestWithLoggerId.id) ||
    randomUUID()
  );
}

function sendSecurityJsonError(
  request: Request,
  response: Response,
  body: {
    error: SecurityJsonError;
    message: string;
    statusCode: 403 | 414 | 415 | 429;
  },
) {
  const requestId = ensureRequestId(request);

  setRequestId(request, requestId);
  response.setHeader('x-request-id', requestId);
  response.status(body.statusCode).json({
    ...body,
    requestId,
  });
}

export function createBodyParserErrorHandler(
  securityAudit: SecurityAuditService,
): ErrorRequestHandler {
  return (error, request: Request, response: Response, next: NextFunction) => {
    const bodyParserError = normalizeBodyParserError(error);

    if (!bodyParserError) {
      next(error);

      return;
    }

    const requestId = ensureRequestId(request);

    setRequestId(request, requestId);
    response.setHeader('x-request-id', requestId);

    if (shouldApplyApiNoStore(request.originalUrl ?? request.url)) {
      response.setHeader('Cache-Control', 'no-store');
    }

    void securityAudit.record({
      eventType: 'http.request_body_rejected',
      metadata: {
        bodyErrorType: bodyParserError.type,
        method: request.method,
        path: getRequestPathname(request.originalUrl ?? request.url ?? '/'),
        statusCode: bodyParserError.statusCode,
      },
      request,
      severity: 'warning',
    });

    response.status(bodyParserError.statusCode).json({
      error: bodyParserError.error,
      message: bodyParserError.message,
      requestId,
      statusCode: bodyParserError.statusCode,
    });
  };
}

function normalizeBodyParserError(error: unknown):
  | {
      error: 'Bad Request' | 'Payload Too Large';
      message: string;
      statusCode: 400 | 413;
      type: string;
    }
  | null {
  if (!isRecord(error)) {
    return null;
  }

  const type = typeof error.type === 'string' ? error.type : '';
  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof error.statusCode === 'number'
        ? error.statusCode
        : null;

  if (type === 'entity.too.large' || status === 413) {
    return {
      error: 'Payload Too Large',
      message: 'Request body is too large.',
      statusCode: 413,
      type: type || 'entity.too.large',
    };
  }

  if (type === 'entity.parse.failed' || status === 400) {
    return {
      error: 'Bad Request',
      message: 'Malformed request body.',
      statusCode: 400,
      type: type || 'entity.parse.failed',
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createApiNoStoreMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    if (shouldApplyApiNoStore(request.originalUrl ?? request.url)) {
      response.setHeader('Cache-Control', 'no-store');
    }

    next();
  };
}

export function shouldApplyApiNoStore(requestTarget: string | undefined) {
  if (!requestTarget) {
    return false;
  }

  const pathname = getRequestPathname(requestTarget);

  if (NO_STORE_OPERATIONAL_PATHS.has(pathname)) {
    return true;
  }

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  return pathname !== '/api/image-proxy';
}

export function createRequestTargetLengthGuard(
  securityAudit: SecurityAuditService,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestTarget = request.originalUrl ?? request.url ?? '';

    if (requestTarget.length <= MAXIMUM_REQUEST_TARGET_LENGTH) {
      next();

      return;
    }

    void securityAudit.record({
      eventType: 'http.request_target_too_long',
      metadata: {
        limit: MAXIMUM_REQUEST_TARGET_LENGTH,
        method: request.method,
        path: getRequestPathname(requestTarget),
        targetLength: requestTarget.length,
      },
      request,
      severity: 'warning',
    });

    sendSecurityJsonError(request, response, {
      message: 'Request target is too long.',
      error: 'URI Too Long',
      statusCode: 414,
    });
  };
}

export async function createSecurityRateLimiters(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
  metricsService?: Pick<MetricsService, 'recordRateLimitExceeded'>,
) {
  const globalRateLimitStore = await createRateLimitStore(config, 'global');
  const authRateLimitStore = await createRateLimitStore(config, 'auth');
  const authSensitiveRateLimitStore = await createRateLimitStore(
    config,
    'auth:sensitive',
  );
  const catalogRateLimitStore = await createRateLimitStore(config, 'catalog');
  const syncRateLimitStore = await createRateLimitStore(config, 'sync');
  const importsGuestRateLimitStore = await createRateLimitStore(
    config,
    'imports:guest',
  );
  const importsAuthenticatedRateLimitStore = await createRateLimitStore(
    config,
    'imports:auth',
  );
  const importsProtectedRateLimitStore = await createRateLimitStore(
    config,
    'imports:protected',
  );
  const imageProxyRateLimitStore = await createRateLimitStore(
    config,
    'image-proxy',
  );
  const mutationRateLimitStore = await createRateLimitStore(
    config,
    'mutations',
  );
  const notionRateLimitStore = await createRateLimitStore(config, 'notion');

  return {
    global: rateLimit(
      buildRateLimitOptions(
        config,
        'global',
        config.globalRateLimitMax,
        globalRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    auth: rateLimit(
      buildRateLimitOptions(
        config,
        'auth',
        config.authRateLimitMax,
        authRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    authSensitive: rateLimit(
      buildRateLimitOptions(
        config,
        'auth_sensitive',
        config.authSensitiveRateLimitMax,
        authSensitiveRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    catalog: rateLimit(
      buildRateLimitOptions(
        config,
        'catalog',
        config.catalogRateLimitMax,
        catalogRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    sync: rateLimit(
      buildRateLimitOptions(
        config,
        'sync',
        config.syncRateLimitMax,
        syncRateLimitStore,
        securityAudit,
        metricsService,
        createSyncRateLimitKeyGenerator(config),
      ),
    ),
    importsGuest: rateLimit({
      ...buildRateLimitOptions(
        config,
        'imports_guest',
        config.importGuestRateLimitMax,
        importsGuestRateLimitStore,
        securityAudit,
        metricsService,
      ),
      skip: (request) =>
        getVerifiedAccessTokenPayload(request, config) !== null,
    }),
    importsAuthenticated: rateLimit({
      ...buildRateLimitOptions(
        config,
        'imports_authenticated',
        config.importAuthenticatedRateLimitMax,
        importsAuthenticatedRateLimitStore,
        securityAudit,
        metricsService,
      ),
      skip: (request) =>
        getVerifiedAccessTokenPayload(request, config) === null,
    }),
    importsProtected: rateLimit(
      buildRateLimitOptions(
        config,
        'imports_protected',
        config.importAuthenticatedRateLimitMax,
        importsProtectedRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    imageProxy: rateLimit(
      buildRateLimitOptions(
        config,
        'image_proxy',
        config.imageProxyRateLimitMax,
        imageProxyRateLimitStore,
        securityAudit,
        metricsService,
      ),
    ),
    mutations: rateLimit({
      ...buildRateLimitOptions(
        config,
        'mutations',
        config.mutationRateLimitMax,
        mutationRateLimitStore,
        securityAudit,
        metricsService,
        createSyncRateLimitKeyGenerator(config),
      ),
      skip: (request) => SAFE_METHODS.has(request.method),
    }),
    notion: rateLimit(
      buildRateLimitOptions(
        config,
        'notion',
        config.notionRateLimitMax,
        notionRateLimitStore,
        securityAudit,
        metricsService,
        createSyncRateLimitKeyGenerator(config),
      ),
    ),
  };
}

export function createApiContentTypeGuard(
  securityAudit: SecurityAuditService,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestTarget = request.originalUrl ?? request.url ?? '';

    if (!shouldValidateApiRequestBodyContentType(request, requestTarget)) {
      next();

      return;
    }

    const contentType = getRequestMediaType(request);

    if (
      contentType !== null &&
      SUPPORTED_API_BODY_MEDIA_TYPES.has(contentType)
    ) {
      next();

      return;
    }

    void securityAudit.record({
      eventType: 'http.unsupported_media_type',
      metadata: {
        contentType: contentType ?? 'missing',
        method: request.method,
        path: getRequestPathname(requestTarget),
        statusCode: 415,
      },
      request,
      severity: 'warning',
    });

    sendSecurityJsonError(request, response, {
      message: 'Unsupported request body media type.',
      error: 'Unsupported Media Type',
      statusCode: 415,
    });
  };
}

function shouldValidateApiRequestBodyContentType(
  request: Request,
  requestTarget: string,
) {
  if (SAFE_METHODS.has(request.method)) {
    return false;
  }

  if (!getRequestPathname(requestTarget).startsWith('/api/')) {
    return false;
  }

  return hasDeclaredRequestBody(request);
}

function hasDeclaredRequestBody(request: Request) {
  const contentLength = request.header('content-length');

  if (contentLength !== undefined && contentLength.trim() !== '') {
    const parsedContentLength = Number(contentLength);

    return Number.isFinite(parsedContentLength) && parsedContentLength > 0;
  }

  return request.header('transfer-encoding') !== undefined;
}

function getRequestMediaType(request: Request) {
  const contentType = request.header('content-type');

  if (!contentType) {
    return null;
  }

  return contentType.split(';', 1)[0]?.trim().toLowerCase() || null;
}

function getRequestPathname(requestTarget: string) {
  try {
    return new URL(requestTarget).pathname;
  } catch {
    // Expected for origin-form request targets such as /api/auth/me.
  }

  try {
    return new URL(requestTarget, 'https://work-archive.local').pathname;
  } catch {
    return requestTarget.split(/[?#]/, 1)[0] || '/';
  }
}

export async function shutdownRedisRateLimitClients() {
  await Promise.all(redisClients.splice(0).map(closeRedisRateLimitClient));
}

async function closeRedisRateLimitClient(client: RedisClient) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<void>((resolve) => {
    timeout = setTimeout(() => {
      client.disconnect();
      resolve();
    }, RATE_LIMIT_REDIS_SHUTDOWN_TIMEOUT_MS);
    timeout.unref();
  });
  const quitPromise = client.quit().catch(() => {
    client.disconnect();
  });

  try {
    await Promise.race([quitPromise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function buildRateLimitOptions(
  config: ApiRuntimeConfig,
  identifier: string,
  limit: number,
  store: Store | undefined,
  securityAudit: SecurityAuditService,
  metricsService?: Pick<MetricsService, 'recordRateLimitExceeded'>,
  keyGenerator?: Options['keyGenerator'],
): Partial<Options> {
  return {
    handler: (request, response, _next, optionsUsed) => {
      metricsService?.recordRateLimitExceeded(identifier);
      void securityAudit.record({
        eventType: 'http.rate_limit_exceeded',
        metadata: {
          limit: Number(optionsUsed.limit),
          limiter: identifier,
          method: request.method,
          path: request.path,
        },
        request,
        severity:
          identifier === 'auth' ||
          identifier === 'auth_sensitive' ||
          identifier === 'catalog' ||
          identifier === 'mutations'
            ? 'warning'
            : 'info',
      });

      sendSecurityJsonError(request, response, {
        message: optionsUsed.message,
        error: 'Too Many Requests',
        statusCode: 429,
      });
    },
    legacyHeaders: false,
    limit,
    passOnStoreError: false,
    standardHeaders: true,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(store ? { store } : {}),
    windowMs: config.rateLimitWindowMs,
  };
}

function createSyncRateLimitKeyGenerator(
  config: ApiRuntimeConfig,
): NonNullable<Options['keyGenerator']> {
  return (request) => {
    const verifiedToken = getVerifiedAccessTokenPayload(request, config);

    if (verifiedToken) {
      return `user:${verifiedToken.sub}:session:${verifiedToken.sid}`;
    }

    return `ip:${ipKeyGenerator(request.ip ?? '')}`;
  };
}

function getVerifiedAccessTokenPayload(
  request: Request,
  config: ApiRuntimeConfig,
) {
  const cachedRequest = request as RequestWithVerifiedAccessTokenPayload;

  if (VERIFIED_ACCESS_TOKEN_PAYLOAD in cachedRequest) {
    return cachedRequest[VERIFIED_ACCESS_TOKEN_PAYLOAD] ?? null;
  }

  const verifiedToken = readVerifiedAccessTokenPayload(request, config);

  cachedRequest[VERIFIED_ACCESS_TOKEN_PAYLOAD] = verifiedToken;

  return verifiedToken;
}

function readVerifiedAccessTokenPayload(
  request: Request,
  config: ApiRuntimeConfig,
): AuthTokenPayload | null {
  const authorization = request.header('authorization');
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '');

  if (!match) {
    return null;
  }

  const token = match[1] ?? '';

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret, {
      algorithms: [AUTH_JWT_ALGORITHM],
      audience: AUTH_JWT_AUDIENCE,
      issuer: AUTH_JWT_ISSUER,
    }) as JwtPayload;

    if (
      !hasExpectedAuthIdentityClaims(decoded) ||
      decoded.type !== 'access' ||
      !hasRequiredAuthJwtClaims(decoded) ||
      !hasExpectedAuthTemporalClaims(decoded, 'access') ||
      !hasExpectedAuthTokenKindClaims(decoded, 'access')
    ) {
      return null;
    }

    const verifiedPayload = decoded as AuthTokenPayload;

    return {
      email: verifiedPayload.email,
      sid: verifiedPayload.sid,
      sub: verifiedPayload.sub,
      type: verifiedPayload.type,
      ...(typeof verifiedPayload.rememberMe === 'boolean'
        ? { rememberMe: verifiedPayload.rememberMe }
        : {}),
    };
  } catch {
    return null;
  }
}

async function createRateLimitStore(
  config: ApiRuntimeConfig,
  identifier: string,
): Promise<Store | undefined> {
  if (config.rateLimitStore === 'memory') {
    return undefined;
  }

  if (!config.redisUrl) {
    throw new Error('REDIS_URL must be configured for Redis rate limiting.');
  }

  const logger = new Logger('RedisRateLimit');
  let redis: RedisClient;

  try {
    redis = await connectRedisClient(config.redisUrl);
    redisClients.push(redis);
  } catch (error) {
    if (config.isProduction) {
      throw error;
    }

    logger.warn(
      JSON.stringify({
        errorCode: describeOperationalError(error),
        event: 'rate_limit.redis_store_unavailable',
        provider: 'redis',
      }),
    );

    return undefined;
  }

  const sendCommand = redis.call.bind(redis) as (
    ...args: string[]
  ) => Promise<RedisReply>;

  return new RedisStore({
    prefix: `${config.rateLimitPrefix}${identifier}:`,
    sendCommand,
  }) as Store;
}

function describeOperationalError(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}
