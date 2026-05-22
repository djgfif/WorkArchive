import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

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

@Injectable()
export class ProviderRuntimeStateService implements OnModuleDestroy {
  private readonly logger = new Logger(ProviderRuntimeStateService.name);
  private readonly cache = new Map<string, ProviderCacheEntry>();
  private readonly circuitState = new Map<ImportProvider, ProviderCircuitState>();
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<Redis | null> | null = null;

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

    await this.writeCircuitState(provider, {
      consecutiveFailures: 0,
      openedUntil: null,
      reasonCode: 'provider_failed',
    });

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
    const redis = await this.getRedis();

    if (redis) {
      await redis.del(this.circuitRedisKey(provider));

      return;
    }

    this.circuitState.delete(provider);
  }

  async recordFailure(
    provider: ImportProvider,
    threshold: number,
    openMs: number,
  ) {
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
      const redis = new Redis(config.redisUrl, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      this.redisConnectPromise = redis
        .connect()
        .then(async () => {
          await redis.ping();
          this.redis = redis;

          return redis;
        })
        .catch((error) => {
          redis.disconnect();
          this.redisConnectPromise = null;

          if (config.isProduction) {
            throw error;
          }

          this.logger.warn(
            `Redis provider state unavailable; using memory state reason=${
              error instanceof Error ? error.message : String(error)
            }`,
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
}
