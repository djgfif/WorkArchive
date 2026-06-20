import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRedisConnect = jest.fn<() => Promise<void>>();
const mockRedisDisconnect = jest.fn<() => void>();
const mockRedisPing = jest.fn<() => Promise<string>>();
const mockRedisQuit = jest.fn<() => Promise<string>>();
const mockRedisCall = jest.fn<(...args: string[]) => Promise<unknown>>();

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

const redisRateLimitConfig: ApiRuntimeConfig = {
  authRateLimitMax: 10,
  clientHeaderGuardMode: 'off',
  cookieSecure: true,
  corsOrigin: ['https://workarchive.example.com'],
  databaseUrl: 'postgresql://work:archive@postgres:5432/work_archive',
  googleOAuthClientId: 'google-client-id',
  googleOAuthClientSecret: 'google-client-secret',
  googleOAuthRedirectUri:
    'https://workarchive.example.com/api/auth/google/callback',
  host: '0.0.0.0',
  importAuthenticatedRateLimitMax: 60,
  importGuestRateLimitMax: 20,
  imageProxyRateLimitMax: 120,
  isProduction: true,
  jsonBodyLimit: '2mb',
  jwtAccessSecret: 'test-access-secret-minimum-32-chars',
  jwtRefreshSecret: 'test-refresh-secret-minimum-32-chars',
  metricsBearerToken: null,
  metricsEnabled: false,
  notionRateLimitMax: 20,
  port: 18731,
  rateLimitPrefix: 'work-archive:test:',
  rateLimitStore: 'redis',
  rateLimitWindowMs: 60_000,
  readinessCheckTimeoutMs: 1500,
  redisUrl: 'redis://redis:6379',
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
    mockRedisCall.mockResolvedValue(null);
  });

  it('quits every Redis-backed rate-limit store client during shutdown', async () => {
    await createSecurityRateLimiters(
      redisRateLimitConfig,
      securityAudit as unknown as SecurityAuditService,
    );

    expect(mockRedisConnect).toHaveBeenCalledTimes(6);
    expect(mockRedisPing).toHaveBeenCalledTimes(6);

    await shutdownRedisRateLimitClients();

    expect(mockRedisQuit).toHaveBeenCalledTimes(6);
    expect(mockRedisDisconnect).not.toHaveBeenCalled();
  });

  it('disconnects clients when Redis quit fails so shutdown can continue', async () => {
    mockRedisQuit.mockRejectedValueOnce(new Error('quit failed'));

    await createSecurityRateLimiters(
      redisRateLimitConfig,
      securityAudit as unknown as SecurityAuditService,
    );
    await shutdownRedisRateLimitClients();

    expect(mockRedisQuit).toHaveBeenCalledTimes(6);
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });
});
