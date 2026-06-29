import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { ProviderRuntimeStateService } from '../src/modules/imports/runtime/provider-runtime-state.service';

describe('ProviderRuntimeStateService', () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_STORE;
    delete process.env.REDIS_URL;
  });

  it('clears an open provider circuit without waiting for the cooldown', async () => {
    delete process.env.REDIS_URL;
    const service = new ProviderRuntimeStateService();

    await service.recordFailure('wikidata', 3, 60_000);
    await service.recordFailure('wikidata', 3, 60_000);
    await service.recordFailure('wikidata', 3, 60_000);

    await expect(service.isCircuitOpen('wikidata')).resolves.toBe(true);

    await service.clearCircuit('wikidata');

    await expect(service.getCircuitStatus('wikidata')).resolves.toEqual({
      circuitOpenedUntil: null,
      circuitReasonCode: null,
      circuitState: 'closed',
    });
    await expect(service.isCircuitOpen('wikidata')).resolves.toBe(false);
  });

  it('records Redis-backed provider failures with an atomic script', async () => {
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.REDIS_URL = 'redis://redis:6379';
    const redis = createRedisMock();
    const service = new ProviderRuntimeStateService();

    (service as unknown as { redis: typeof redis }).redis = redis;

    await service.recordFailure('wikidata', 3, 60_000);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("INCR", KEYS[2])'),
      2,
      'work-archive:imports:circuit:wikidata',
      'work-archive:imports:circuit-failures:wikidata',
      '3',
      '60000',
      expect.any(String),
    );
  });

  it('clears both Redis circuit state and failure-count keys', async () => {
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.REDIS_URL = 'redis://redis:6379';
    const redis = createRedisMock();
    const service = new ProviderRuntimeStateService();

    (service as unknown as { redis: typeof redis }).redis = redis;

    await service.clearCircuit('wikidata');

    expect(redis.del).toHaveBeenCalledWith(
      'work-archive:imports:circuit:wikidata',
      'work-archive:imports:circuit-failures:wikidata',
    );
  });
});

function createRedisMock() {
  return {
    del: jest.fn(async (..._args: unknown[]) => 1),
    eval: jest.fn(async (..._args: unknown[]) => '{}'),
    get: jest.fn(async (..._args: unknown[]) => null),
    quit: jest.fn(async (..._args: unknown[]) => 'OK'),
    set: jest.fn(async (..._args: unknown[]) => 'OK'),
  };
}
