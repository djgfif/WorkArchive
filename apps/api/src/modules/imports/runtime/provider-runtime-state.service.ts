import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import {
  connectRedisClient,
  type RedisClient,
} from '../../../common/redis-client';
import { readApiRuntimeConfig } from '../../../config/api-runtime-config';
import type { ImportProvider } from '../imports.constants';

export interface ProviderCircuitStatus {
  circuitOpenedUntil: string | null;
  circuitReasonCode: 'provider_failed' | null;
  circuitState: 'closed' | 'open';
}

interface ProviderCircuitState {
  consecutiveFailures: number;
  openedUntil: number | null;
  reasonCode: 'provider_failed';
}

interface ProviderCacheEntry {
  expiresAt: number;
  value: unknown;
}

const RECORD_PROVIDER_FAILURE_SCRIPT = `
local failures = redis.call("INCR", KEYS[2])
redis.call("PEXPIRE", KEYS[2], ARGV[2])

local openedUntil = cjson.null
if failures >= tonumber(ARGV[1]) then
  openedUntil = tonumber(ARGV[3]) + tonumber(ARGV[2])
end

local state = cjson.encode({
  consecutiveFailures = failures,
  openedUntil = openedUntil,
  reasonCode = "provider_failed"
})

redis.call("SET", KEYS[1], state, "PX", ARGV[2])
return state
`;

@Injectable()
export class ProviderRuntimeStateService implements OnModuleDestroy {
  private readonly logger = new Logger(ProviderRuntimeStateService.name);
  private readonly cache = new Map<string, ProviderCacheEntry>();
  private readonly circuitState = new Map<ImportProvider, ProviderCircuitState>();
  private redis: RedisClient | null = null;
  private redisConnectPromise: Promise<RedisClient | null> | null = null;

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async readCache(cacheKey: string | undefined) {
    if (!cacheKey) {
      return undefined;
    }

    const redis = await this.getRedis();

    if (redis) {
      const value = await redis.get(this.cacheRedisKey(cacheKey));

      return value === null ? undefined : JSON.parse(value);
    }

    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);

      return undefined;
    }

    return cached.value;
  }

  async writeCache(
    cacheKey: string | undefined,
    value: unknown,
    ttlMs: number,
  ) {
    if (!cacheKey || ttlMs <= 0) {
      return;
    }

    const redis = await this.getRedis();

    if (redis) {
      await redis.set(
        this.cacheRedisKey(cacheKey),
        JSON.stringify(value),
        'PX',
        ttlMs,
      );

      return;
    }

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  async isCircuitOpen(provider: ImportProvider) {
    const state = await this.readCircuitState(provider);

    if (!state?.openedUntil) {
      return false;
    }

    if (Date.now() < state.openedUntil) {
      return true;
    }

    await this.clearCircuit(provider);

    return false;
  }

  async getCircuitStatus(provider: ImportProvider): Promise<ProviderCircuitStatus> {
    const state = await this.readCircuitState(provider);

    if (!state?.openedUntil || Date.now() >= state.openedUntil) {
      return {
        circuitOpenedUntil: null,
        circuitReasonCode: null,
        circuitState: 'closed',
      };
    }

    return {
      circuitOpenedUntil: new Date(state.openedUntil).toISOString(),
      circuitReasonCode: state.reasonCode,
      circuitState: 'open',
    };
  }

  async recordSuccess(provider: ImportProvider) {
    await this.clearCircuit(provider);
  }

  async clearCircuit(provider: ImportProvider) {
    const redis = await this.getRedis();

    if (redis) {
      await redis.del(
        this.circuitRedisKey(provider),
        this.circuitFailureCountRedisKey(provider),
      );

      return;
    }

    this.circuitState.delete(provider);
  }

  async recordFailure(
    provider: ImportProvider,
    threshold: number,
    openMs: number,
  ) {
    const redis = await this.getRedis();

    if (redis) {
      await redis.eval(
        RECORD_PROVIDER_FAILURE_SCRIPT,
        2,
        this.circuitRedisKey(provider),
        this.circuitFailureCountRedisKey(provider),
        String(threshold),
        String(openMs),
        String(Date.now()),
      );

      return;
    }

    const current = (await this.readCircuitState(provider)) ?? {
      consecutiveFailures: 0,
      openedUntil: null,
      reasonCode: 'provider_failed' as const,
    };
    const consecutiveFailures = current.consecutiveFailures + 1;

    await this.writeCircuitState(provider, {
      consecutiveFailures,
      openedUntil:
        consecutiveFailures >= threshold ? Date.now() + openMs : null,
      reasonCode: 'provider_failed',
    });
  }

  private async readCircuitState(provider: ImportProvider) {
    const redis = await this.getRedis();

    if (redis) {
      const value = await redis.get(this.circuitRedisKey(provider));

      return value === null
        ? null
        : (JSON.parse(value) as ProviderCircuitState);
    }

    return this.circuitState.get(provider) ?? null;
  }

  private async writeCircuitState(
    provider: ImportProvider,
    state: ProviderCircuitState,
  ) {
    const redis = await this.getRedis();

    if (redis) {
      if (state.openedUntil) {
        await redis.set(
          this.circuitRedisKey(provider),
          JSON.stringify(state),
          'PX',
          Math.max(1, state.openedUntil - Date.now()),
        );
      } else {
        await redis.set(this.circuitRedisKey(provider), JSON.stringify(state));
      }

      return;
    }

    this.circuitState.set(provider, state);
  }

  private async getRedis() {
    const config = readApiRuntimeConfig();

    if (!config.redisUrl) {
      return null;
    }

    if (this.redis) {
      return this.redis;
    }

    if (!this.redisConnectPromise) {
      this.redisConnectPromise = connectRedisClient(config.redisUrl)
        .then((redis) => {
          this.redis = redis;

          return redis;
        })
        .catch((error) => {
          this.redisConnectPromise = null;

          if (config.isProduction) {
            throw error;
          }

          this.logger.warn(
            JSON.stringify({
              errorCode: describeOperationalError(error),
              event: 'import_provider.redis_state_unavailable',
              provider: 'redis',
            }),
          );

          return null;
        });
    }

    return this.redisConnectPromise;
  }

  private cacheRedisKey(cacheKey: string) {
    return `work-archive:imports:cache:${cacheKey}`;
  }

  private circuitRedisKey(provider: ImportProvider) {
    return `work-archive:imports:circuit:${provider}`;
  }

  private circuitFailureCountRedisKey(provider: ImportProvider) {
    return `work-archive:imports:circuit-failures:${provider}`;
  }
}

function describeOperationalError(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError';
}
