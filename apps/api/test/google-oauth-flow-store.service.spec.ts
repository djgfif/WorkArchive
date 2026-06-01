import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { GoogleOAuthFlowStoreService } from '../src/modules/auth/google-oauth-flow-store.service';

const ORIGINAL_ENV = { ...process.env };

describe('GoogleOAuthFlowStoreService', () => {
  let service: GoogleOAuthFlowStoreService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/work_archive';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';
    service = new GoogleOAuthFlowStoreService();
    jest.useRealTimers();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    process.env = { ...ORIGINAL_ENV };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('consumes memory-backed OAuth flows only once', async () => {
    await service.store(
      'flow-id',
      {
        expiresAt: Date.now() + 60_000,
        nonceHash: 'nonce-hash',
        returnOrigin: 'http://localhost:18730',
        stateHash: 'state-hash',
      },
      60_000,
    );

    await expect(service.consume('flow-id')).resolves.toMatchObject({
      nonceHash: 'nonce-hash',
      returnOrigin: 'http://localhost:18730',
      stateHash: 'state-hash',
    });
    await expect(service.consume('flow-id')).resolves.toBeNull();
  });

  it('rejects expired memory-backed OAuth flows', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

    await service.store(
      'flow-id',
      {
        expiresAt: Date.now() + 1_000,
        nonceHash: 'nonce-hash',
        returnOrigin: 'http://localhost:18730',
        stateHash: 'state-hash',
      },
      1_000,
    );

    jest.setSystemTime(new Date('2026-06-01T00:00:02.000Z'));

    await expect(service.consume('flow-id')).resolves.toBeNull();
  });
});
