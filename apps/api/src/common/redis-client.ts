import Redis from 'ioredis';

const REDIS_CLIENT_OPTIONS = {
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
} as const;

export function createRedisClient(redisUrl: string) {
  return new Redis(redisUrl, REDIS_CLIENT_OPTIONS);
}

export type RedisClient = ReturnType<typeof createRedisClient>;

interface ConnectRedisClientOptions {
  timeoutMs?: number;
}

export async function connectRedisClient(
  redisUrl: string,
  options: ConnectRedisClientOptions = {},
) {
  const redis = createRedisClient(redisUrl);
  let disconnected = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const disconnectOnce = () => {
    if (!disconnected) {
      disconnected = true;
      redis.disconnect();
    }
  };

  try {
    const connectAndPing = async () => {
      await redis.connect();
      await redis.ping();

      return redis;
    };

    if (!options.timeoutMs) {
      return await connectAndPing();
    }

    return await Promise.race([
      connectAndPing(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          disconnectOnce();
          reject(
            new Error(
              `Redis connection timed out after ${options.timeoutMs}ms.`,
            ),
          );
        }, options.timeoutMs);
      }),
    ]);
  } catch (error) {
    disconnectOnce();

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
