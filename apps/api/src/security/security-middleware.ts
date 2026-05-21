import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type Options, type Store } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { randomUUID } from 'node:crypto';

import type { ApiRuntimeConfig } from '../config/api-runtime-config';
import type { SecurityAuditService } from './security-audit.service';
import { setRequestId } from './security-audit.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const redisClients: Redis[] = [];

export function createProductionOriginGuard(
  config: ApiRuntimeConfig,
  securityAudit: SecurityAuditService,
) {
  const allowedOrigins = new Set(config.corsOrigin);

  return (request: Request, response: Response, next: NextFunction) => {
    if (!config.isProduction || SAFE_METHODS.has(request.method)) {
      next();

      return;
    }

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

export function createRequestIdMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const headerRequestId = request.header('x-request-id');
    const requestWithLoggerId = request as Request & {
      id?: string;
    };
    const requestId =
      headerRequestId?.trim() ||
      (typeof requestWithLoggerId.id === 'string'
        ? requestWithLoggerId.id
        : null) ||
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
