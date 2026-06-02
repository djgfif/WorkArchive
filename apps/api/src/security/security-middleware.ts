import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type Options, type Store } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { randomUUID } from 'node:crypto';

import type { ApiRuntimeConfig } from '../config/api-runtime-config';
import { normalizeRequestId } from './request-id';
import type { SecurityAuditService } from './security-audit.service';
import { setRequestId } from './security-audit.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WORK_ARCHIVE_CLIENT_HEADER = 'x-work-archive-client';
const WORK_ARCHIVE_CLIENT_HEADER_VALUE = 'web';
const redisClients: Redis[] = [];

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

    response.status(403).json({
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

    response.status(403).json({
      message: 'Origin is not allowed.',
      error: 'Forbidden',
      statusCode: 403,
    });
  };
}

export function createProductionClientHeaderGuard(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
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
      next();

      return;
    }

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

    response.status(403).json({
      message: 'Required client header is missing.',
      error: 'Forbidden',
      statusCode: 403,
    });
  };
}

function hasBearerAuthorization(request: Request) {
  const authorization = request.header('authorization')?.trim();

  return /^Bearer\s+\S+$/i.test(authorization ?? '');
}

export function createRequestIdMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestWithLoggerId = request as Request & {
      id?: string;
    };
    const requestId =
      normalizeRequestId(request.header('x-request-id')) ||
      normalizeRequestId(requestWithLoggerId.id) ||
      randomUUID();

    setRequestId(request, requestId);
    response.setHeader('x-request-id', requestId);
    next();
  };
}

export async function createSecurityRateLimiters(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
) {
  const authRateLimitStore = await createRateLimitStore(config, 'auth');
  const syncRateLimitStore = await createRateLimitStore(config, 'sync');
  const importsGuestRateLimitStore = await createRateLimitStore(
    config,
    'imports:guest',
  );
  const importsAuthenticatedRateLimitStore = await createRateLimitStore(
    config,
    'imports:auth',
  );

  return {
    auth: rateLimit(
      buildRateLimitOptions(
        config,
        'auth',
        config.authRateLimitMax,
        authRateLimitStore,
        securityAudit,
      ),
    ),
    sync: rateLimit(
      buildRateLimitOptions(
        config,
        'sync',
        config.syncRateLimitMax,
        syncRateLimitStore,
        securityAudit,
      ),
    ),
    importsGuest: rateLimit({
      ...buildRateLimitOptions(
        config,
        'imports_guest',
        config.importGuestRateLimitMax,
        importsGuestRateLimitStore,
        securityAudit,
      ),
      skip: (request) => Boolean(request.header('authorization')),
    }),
    importsAuthenticated: rateLimit({
      ...buildRateLimitOptions(
        config,
        'imports_authenticated',
        config.importAuthenticatedRateLimitMax,
        importsAuthenticatedRateLimitStore,
        securityAudit,
      ),
      skip: (request) => !request.header('authorization'),
    }),
  };
}

export async function shutdownRedisRateLimitClients() {
  await Promise.all(redisClients.splice(0).map((client) => client.quit()));
}

function buildRateLimitOptions(
  config: ApiRuntimeConfig,
  identifier: string,
  limit: number,
  store: Store | undefined,
  securityAudit: SecurityAuditService,
): Partial<Options> {
  return {
    handler: (request, response, _next, optionsUsed) => {
      void securityAudit.record({
        eventType: 'http.rate_limit_exceeded',
        metadata: {
          limit: Number(optionsUsed.limit),
          limiter: identifier,
          method: request.method,
          path: request.path,
        },
        request,
        severity: identifier === 'auth' ? 'warning' : 'info',
      });

      response.status(optionsUsed.statusCode).json({
        message: optionsUsed.message,
        error: 'Too Many Requests',
        statusCode: optionsUsed.statusCode,
      });
    },
    legacyHeaders: false,
    limit,
    passOnStoreError: false,
    standardHeaders: true,
    ...(store ? { store } : {}),
    windowMs: config.rateLimitWindowMs,
  };
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
  const redis = new Redis(config.redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    await redis.ping();
    redisClients.push(redis);
  } catch (error) {
    redis.disconnect();

    if (config.isProduction) {
      throw error;
    }

    logger.warn(
      `Redis rate limit store unavailable; using memory store reason=${
        error instanceof Error ? error.message : String(error)
      }`,
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
