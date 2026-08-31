import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRedisConnect = jest.fn<() => Promise<void>>();
const mockRedisDisconnect = jest.fn<() => void>();
const mockRedisPing = jest.fn<() => Promise<string>>();
const mockRedisQuit = jest.fn<() => Promise<string>>();
const mockRedisCall = jest.fn<(...args: string[]) => Promise<unknown>>();

const mockSuccessfulRedisRateLimitCommand = async (...args: string[]) => {
  const [command, subcommand, script = ''] = args;

  if (command === 'SCRIPT' && subcommand === 'LOAD') {
    return `sha:${script.length}`;
  }

  if (command === 'EVALSHA') {
    return [1, 60_000];
  }

  return null;
};
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    call: mockRedisCall,
    connect: mockRedisConnect,
    disconnect: mockRedisDisconnect,
    ping: mockRedisPing,
    quit: mockRedisQuit,
  })),
);

import type { ApiRuntimeConfig } from '../src/config/api-runtime-config';
import {
  createSecurityRateLimiters,
  shutdownRedisRateLimitClients,
} from '../src/security/security-middleware';
import type { SecurityAuditService } from '../src/security/security-audit.service';

const REDIS_RATE_LIMIT_STORE_COUNT = 11;

const redisRateLimitConfig: ApiRuntimeConfig = {
  authRateLimitMax: 10,
  authSensitiveRateLimitMax: 5,
  catalogRateLimitMax: 20,
  globalRateLimitMax: 600,
  clientHeaderGuardMode: 'off',
  cookieSecure: true,
  corsOrigin: ['https://workarchive.example.com'],
  databaseUrl: 'postgresql://work:archive@postgres:5432/work_archive',
  googleOAuthClientId: 'google-client-id',
  googleOAuthClientSecret: 'google-client-secret',
  googleOAuthRedirectUri:
    'https://workarchive.example.com/api/auth/google/callback',
  headersTimeoutMs: 15_000,
  host: '0.0.0.0',
  importAuthenticatedRateLimitMax: 60,
  importGuestRateLimitMax: 20,
  imageProxyRateLimitMax: 120,
  isProduction: true,
  jsonBodyLimit: '2mb',
  jwtAccessSecret: 'test-access-secret-minimum-32-chars',
  jwtRefreshSecret: 'test-refresh-secret-minimum-32-chars',
  keepAliveTimeoutMs: 5_000,
  logLevel: 'info',
  metricsBearerToken: null,
  metricsEnabled: false,
  mutationRateLimitMax: 120,
  notionRateLimitMax: 20,
  port: 18731,
  rateLimitPrefix: 'work-archive:test:',
  rateLimitStore: 'redis',
  rateLimitWindowMs: 60_000,
  readinessCheckTimeoutMs: 1500,
  redisUrl: 'redis://redis:6379',
  requestTimeoutMs: 120_000,
  securityEventHashSecret: 'test-security-event-secret-minimum-32-chars',
  swaggerEnabled: false,
  syncRateLimitMax: 30,
  trustProxyHops: 1,
  urlencodedBodyLimit: '64kb',
  webBaseUrl: 'https://workarchive.example.com',
};

describe('security rate-limit Redis shutdown', () => {
  const securityAudit = {
    record: jest.fn<SecurityAuditService['record']>().mockResolvedValue(),
  };

  beforeEach(async () => {
    await shutdownRedisRateLimitClients();
    jest.clearAllMocks();
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
    mockRedisQuit.mockResolvedValue('OK');
    mockRedisCall.mockImplementation(mockSuccessfulRedisRateLimitCommand);
  });

  it('quits every Redis-backed rate-limit store client during shutdown', async () => {
    await createSecurityRateLimiters(
      redisRateLimitConfig,
      securityAudit as unknown as SecurityAuditService,
    );

    expect(mockRedisConnect).toHaveBeenCalledTimes(
      REDIS_RATE_LIMIT_STORE_COUNT,
    );
    expect(mockRedisPing).toHaveBeenCalledTimes(REDIS_RATE_LIMIT_STORE_COUNT);

    await shutdownRedisRateLimitClients();

    expect(mockRedisQuit).toHaveBeenCalledTimes(REDIS_RATE_LIMIT_STORE_COUNT);
    expect(mockRedisDisconnect).not.toHaveBeenCalled();
  });

  it('disconnects clients when Redis quit fails so shutdown can continue', async () => {
    mockRedisQuit.mockRejectedValueOnce(new Error('quit failed'));

    await createSecurityRateLimiters(
      redisRateLimitConfig,
      securityAudit as unknown as SecurityAuditService,
    );
    await shutdownRedisRateLimitClients();

    expect(mockRedisQuit).toHaveBeenCalledTimes(REDIS_RATE_LIMIT_STORE_COUNT);
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });

  it('logs non-production Redis rate-limit fallback without raw Redis errors', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    mockRedisConnect.mockRejectedValue(
      new Error('redis://:secret@localhost:6379 access_token raw payload'),
    );

    await createSecurityRateLimiters(
      {
        ...redisRateLimitConfig,
        isProduction: false,
      },
      securityAudit as unknown as SecurityAuditService,
    );

    const warning = String(warnSpy.mock.calls[0]?.[0] ?? '');

    expect(JSON.parse(warning)).toEqual(
      expect.objectContaining({
        errorCode: 'Error',
        event: 'rate_limit.redis_store_unavailable',
        provider: 'redis',
      }),
    );
    expect(warnSpy.mock.calls.flat().join(' ')).not.toMatch(
      /redis:\/\/:secret|access_token|raw payload/,
    );

    warnSpy.mockRestore();
  });
});
