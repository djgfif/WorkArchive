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

export async function connectRedisClient(redisUrl: string) {
  const redis = createRedisClient(redisUrl);

  try {
    await redis.connect();
    await redis.ping();

    return redis;
  } catch (error) {
    redis.disconnect();

    throw error;
  }
}
