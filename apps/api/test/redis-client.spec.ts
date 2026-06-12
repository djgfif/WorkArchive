import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import Redis from 'ioredis';

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

import { connectRedisClient, createRedisClient } from '../src/common/redis-client';

describe('redis client helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('creates Redis clients with bounded agent-friendly options', () => {
    const redis = createRedisClient('redis://redis:6379');

    expect(redis).toEqual(
      expect.objectContaining({
        connect: mockRedisConnect,
        disconnect: mockRedisDisconnect,
        ping: mockRedisPing,
      }),
    );
    expect(Redis).toHaveBeenCalledWith('redis://redis:6379', {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  });

  it('connects and pings before returning the client', async () => {
    const redis = await connectRedisClient('redis://redis:6379');

    expect(redis).toEqual(
      expect.objectContaining({
        connect: mockRedisConnect,
        disconnect: mockRedisDisconnect,
        ping: mockRedisPing,
      }),
    );
    expect(mockRedisConnect).toHaveBeenCalledTimes(1);
    expect(mockRedisPing).toHaveBeenCalledTimes(1);
    expect(mockRedisDisconnect).not.toHaveBeenCalled();
  });

  it('disconnects failed connection attempts before rethrowing', async () => {
    const error = new Error('redis down');
    mockRedisConnect.mockRejectedValue(error);

    await expect(connectRedisClient('redis://redis:6379')).rejects.toThrow(
      error,
    );

    expect(mockRedisPing).not.toHaveBeenCalled();
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });
});
