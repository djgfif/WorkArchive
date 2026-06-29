import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  describePrismaStartupError,
  PrismaService,
  readPrismaConnectTimeoutMs,
} from '../src/prisma/prisma.service';

const ORIGINAL_ENV = { ...process.env };

describe('PrismaService runtime config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('defaults the PostgreSQL connect timeout when unset', () => {
    delete process.env.PRISMA_CONNECT_TIMEOUT_MS;

    expect(readPrismaConnectTimeoutMs()).toBe(10_000);
  });

  it('reads an explicit positive integer PostgreSQL connect timeout', () => {
    process.env.PRISMA_CONNECT_TIMEOUT_MS = '2500';

    expect(readPrismaConnectTimeoutMs()).toBe(2500);
  });

  it('rejects PostgreSQL connect timeout values with suffixes or decimals', () => {
    process.env.PRISMA_CONNECT_TIMEOUT_MS = '2500ms';

    expect(() => readPrismaConnectTimeoutMs()).toThrow(
      /PRISMA_CONNECT_TIMEOUT_MS must be a positive integer/,
    );

    process.env.PRISMA_CONNECT_TIMEOUT_MS = '2.5';

    expect(() => readPrismaConnectTimeoutMs()).toThrow(
      /PRISMA_CONNECT_TIMEOUT_MS must be a positive integer/,
    );
  });

  it('rejects non-positive PostgreSQL connect timeout values', () => {
    process.env.PRISMA_CONNECT_TIMEOUT_MS = '0';

    expect(() => readPrismaConnectTimeoutMs()).toThrow(
      /PRISMA_CONNECT_TIMEOUT_MS must be a positive integer/,
    );
  });

  it('describes startup errors without raw database details', () => {
    expect(
      describePrismaStartupError(
        new Error('DATABASE_URL=postgresql://secret access_token raw payload'),
      ),
    ).toBe('Error');
    expect(describePrismaStartupError('raw string')).toBe('UnknownError');
  });

  it('logs startup connection failures without stack traces or database URLs', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new PrismaService();

    jest
      .spyOn(service, '$connect')
      .mockRejectedValue(
        new Error('DATABASE_URL=postgresql://secret access_token raw payload'),
      );

    await expect(service.onModuleInit()).rejects.toThrow(
      'DATABASE_URL=postgresql://secret',
    );

    const logPayload = String(errorSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual({
      errorCode: 'Error',
      event: 'postgres.connect.failed',
    });
    expect(errorSpy.mock.calls.at(-1)).toHaveLength(1);
    expect(logPayload).not.toMatch(
      /DATABASE_URL|postgresql:\/\/secret|access_token|raw payload|stack/i,
    );
  });
});
