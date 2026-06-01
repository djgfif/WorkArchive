import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';

const GOOGLE_OAUTH_FLOW_KEY_PREFIX = 'work-archive:auth:google-oauth-flow:';
const GOOGLE_OAUTH_MAX_MEMORY_FLOWS = 1000;

export interface GoogleOAuthFlowRecord {
  expiresAt: number;
  nonceHash: string;
  returnOrigin: string;
  stateHash: string;
}

@Injectable()
export class GoogleOAuthFlowStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(GoogleOAuthFlowStoreService.name);
  private readonly memoryFlows = new Map<string, GoogleOAuthFlowRecord>();
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<Redis | null> | null = null;

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async store(flowId: string, flow: GoogleOAuthFlowRecord, ttlMs: number) {
    const redis = await this.getRedis();

    if (redis) {
      await redis.set(
        this.redisKey(flowId),
        JSON.stringify(flow),
        'PX',
        Math.max(1, ttlMs),
      );
      return;
    }

    this.storeInMemory(flowId, flow);
  }

  async consume(flowId: string) {
    const redis = await this.getRedis();

    if (redis) {
      const value = await this.consumeRedisKey(redis, this.redisKey(flowId));

      return this.deserializeFlow(value);
    }

    const flow = this.memoryFlows.get(flowId) ?? null;
    this.memoryFlows.delete(flowId);

    return this.isFreshFlow(flow) ? flow : null;
  }

  private storeInMemory(flowId: string, flow: GoogleOAuthFlowRecord) {
    this.purgeExpiredMemoryFlows(Date.now());

    if (this.memoryFlows.size >= GOOGLE_OAUTH_MAX_MEMORY_FLOWS) {
      const oldestFlowId = this.memoryFlows.keys().next().value as
        | string
        | undefined;

      if (oldestFlowId) {
        this.memoryFlows.delete(oldestFlowId);
      }
    }

    this.memoryFlows.set(flowId, flow);
  }

  private purgeExpiredMemoryFlows(now: number) {
    for (const [flowId, flow] of this.memoryFlows) {
      if (flow.expiresAt <= now) {
        this.memoryFlows.delete(flowId);
      }
    }
  }

  private async consumeRedisKey(redis: Redis, key: string) {
    const result = await redis.multi().get(key).del(key).exec();
    const value = result?.[0]?.[1];

    return typeof value === 'string' ? value : null;
  }

  private deserializeFlow(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<GoogleOAuthFlowRecord>;

      if (
        typeof parsed.expiresAt !== 'number' ||
        typeof parsed.nonceHash !== 'string' ||
        typeof parsed.returnOrigin !== 'string' ||
        typeof parsed.stateHash !== 'string'
      ) {
        return null;
      }

      const flow = {
        expiresAt: parsed.expiresAt,
        nonceHash: parsed.nonceHash,
        returnOrigin: parsed.returnOrigin,
        stateHash: parsed.stateHash,
      };

      return this.isFreshFlow(flow) ? flow : null;
    } catch {
      return null;
    }
  }

  private isFreshFlow(flow: GoogleOAuthFlowRecord | null) {
    return Boolean(flow && flow.expiresAt > Date.now());
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
            throw new ServiceUnavailableException(
              'Google OAuth flow storage is unavailable.',
            );
          }

          this.logger.warn(
            `Redis OAuth flow store unavailable; using memory store reason=${
              error instanceof Error ? error.name : 'unknown'
            }`,
          );

          return null;
        });
    }

    return this.redisConnectPromise;
  }

  private redisKey(flowId: string) {
    return `${GOOGLE_OAUTH_FLOW_KEY_PREFIX}${flowId}`;
  }
}
