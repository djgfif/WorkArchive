import { ServiceUnavailableException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mockRedisConnect = jest.fn<() => Promise<void>>();
const mockRedisDisconnect = jest.fn<() => void>();
const mockRedisPing = jest.fn<() => Promise<string>>();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockRedisConnect,
    disconnect: mockRedisDisconnect,
    ping: mockRedisPing,
  })),
);

import { HealthController } from '../src/modules/health/health.controller';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController', () => {
  const originalEnv = { ...process.env };
  let prisma: {
    $queryRaw: jest.Mock<() => Promise<unknown>>;
  };
  let controller: HealthController;
  let migrationNames: string[];

  function mockReadyPostgresAndMigrations() {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ failedCount: 0 }])
      .mockResolvedValueOnce(
        migrationNames.map((migrationName) => ({ migrationName })),
      );
  }

  beforeEach(() => {
    migrationNames = readdirSync(resolve(process.cwd(), 'prisma/migrations'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://work:archive@localhost:5432/work_archive',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      NODE_ENV: 'test',
      RATE_LIMIT_STORE: 'memory',
      SECURITY_EVENT_HASH_SECRET: 'test-security-event-hash-secret',
    };
    prisma = {
      $queryRaw: jest.fn<() => Promise<unknown>>(),
    };
    controller = new HealthController(prisma as unknown as PrismaService);
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('keeps /health backward compatible', () => {
    expect(controller.getHealth()).toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
  });

  it('returns /livez liveness without checking PostgreSQL or Redis', () => {
    prisma.$queryRaw.mockRejectedValue(new Error('postgres down'));
    mockRedisPing.mockRejectedValue(new Error('redis down'));

    expect(controller.getLiveness()).toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockRedisPing).not.toHaveBeenCalled();
  });

  it('returns 503 readiness when PostgreSQL is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('postgres down'));

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 readiness when Prisma migrations are unavailable or failed', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ failedCount: 1 }]);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 readiness when local Prisma migrations are pending in PostgreSQL', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ failedCount: 0 }])
      .mockResolvedValueOnce(
        migrationNames.slice(0, -1).map((migrationName) => ({ migrationName })),
      );

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 503 readiness when production Redis rate limit store is unavailable', async () => {
    process.env = {
      ...process.env,
      COOKIE_SECURE: 'true',
      CORS_ORIGIN: 'https://workarchive.example.com',
      EXTERNAL_API_KEY_ENCRYPTION_SECRET:
        'production-external-api-key-secret-minimum-32-chars',
      GOOGLE_OAUTH_REDIRECT_URI:
        'https://workarchive.example.com/api/auth/google/callback',
      JWT_ACCESS_SECRET: 'production-access-secret-minimum-32-chars',
      JWT_REFRESH_SECRET: 'production-refresh-secret-minimum-32-chars',
      NODE_ENV: 'production',
      RATE_LIMIT_STORE: 'redis',
      REDIS_URL: 'redis://127.0.0.1:6379',
      SECURITY_EVENT_HASH_SECRET:
        'production-security-event-secret-minimum-32-chars',
      SEED_DEMO_PASSWORD: 'not-demo-password',
      SWAGGER_ENABLED: 'false',
      TRUST_PROXY_HOPS: '1',
      WEB_BASE_URL: 'https://workarchive.example.com',
    };
    mockReadyPostgresAndMigrations();
    mockRedisPing.mockRejectedValue(new Error('redis down'));

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mockRedisConnect).toHaveBeenCalled();
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });

  it('documents that compose.prod.yml healthcheck uses /readyz', () => {
    const compose = readFileSync(
      resolve(process.cwd(), '../../compose.prod.yml'),
      'utf8',
    );

    expect(compose).toContain('/readyz');
    expect(compose).not.toContain('/health');
  });

  it('documents that local compose runs migrations before API readiness', () => {
    const compose = readFileSync(
      resolve(process.cwd(), '../../compose.yml'),
      'utf8',
    );
    const startDev = readFileSync(
      resolve(process.cwd(), '../../scripts/dev/start-dev.sh'),
      'utf8',
    );

    expect(compose).toContain('api-migrate:');
    expect(compose).toContain('target: release');
    expect(compose).toContain('service_completed_successfully');
    expect(compose).toContain('/readyz');
    expect(compose).toContain('/work-archive-config.js');
    expect(compose).toContain(
      'CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8080,http://127.0.0.1:8080,http://127.0.0.1:53173,http://localhost:53173}',
    );
    expect(compose).toContain(
      'WEB_BASE_URL: ${WEB_BASE_URL:-http://localhost:8080}',
    );
    expect(compose).toContain('VITE_API_BASE_URL: /api');
    expect(startDev).toContain(
      'COMPOSE_ENV_FILE="${WORK_ARCHIVE_COMPOSE_ENV_FILE:-.env.compose}"',
    );
    expect(startDev).toContain(
      'HOST_ENV_FILE="${WORK_ARCHIVE_HOST_ENV_FILE:-.env.host}"',
    );
    expect(startDev).toContain('docker compose --env-file "$compose_env_file"');
    expect(startDev).toContain('docker compose --env-file "$host_env_file"');
    expect(startDev).toContain(
      '"${docker_compose[@]}" rm -f -s api-migrate',
    );
    expect(startDev).toContain(
      '"${docker_compose[@]}" up --build --force-recreate --no-deps api-migrate',
    );
  });

  it('documents separate public origins for compose and host development env files', () => {
    const rootEnvExample = readFileSync(
      resolve(process.cwd(), '../../.env.example'),
      'utf8',
    );
    const composeEnvExample = readFileSync(
      resolve(process.cwd(), '../../.env.compose.example'),
      'utf8',
    );
    const hostEnvExample = readFileSync(
      resolve(process.cwd(), '../../.env.host.example'),
      'utf8',
    );
    const apiEnvExample = readFileSync(
      resolve(process.cwd(), '.env.example'),
      'utf8',
    );

    expect(rootEnvExample).toContain('WEB_BASE_URL="http://localhost:8080"');
    expect(rootEnvExample).toContain('VITE_API_BASE_URL="/api"');
    expect(rootEnvExample).toContain(
      'CORS_ORIGIN="http://localhost:8080,http://127.0.0.1:8080,http://127.0.0.1:53173,http://localhost:53173"',
    );
    expect(composeEnvExample).toContain(
      'WEB_BASE_URL="http://localhost:8080"',
    );
    expect(composeEnvExample).toContain('VITE_API_BASE_URL="/api"');
    expect(hostEnvExample).toContain(
      'WEB_BASE_URL="http://127.0.0.1:53173"',
    );
    expect(hostEnvExample).toContain(
      'VITE_API_BASE_URL="http://localhost:3000/api"',
    );
    expect(apiEnvExample).toContain('WEB_BASE_URL="http://127.0.0.1:53173"');
    expect(apiEnvExample).toContain(
      'PUBLIC_WEB_BASE_URL="http://127.0.0.1:53173"',
    );
    expect(apiEnvExample).toContain(
      'GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"',
    );
  });
});
