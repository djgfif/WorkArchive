import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';

import {
  connectRedisClient,
  type RedisClient,
} from '../../common/redis-client';
import { fetchExternal } from '../../common/external-fetch';
import {
  PublicAddressResolutionError,
  resolvePublicNetworkAddress,
} from '../../common/network-address-policy';
import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  assertAllowedImageUrl,
  buildCachedImage,
  deserializeCachedImage,
  FETCH_TIMEOUT_MS,
  FETCH_FAILURE_COOLDOWN_MS,
  getAllowedImageContentType,
  imageRedisKey,
  isRedirectStatus,
  MAX_IMAGE_BYTES,
  MAX_MEMORY_CACHE_ENTRIES,
  MAX_REDIRECTS,
  parseAllowedImageUrl,
  readLimitedImageBody,
  serializeCachedImage,
  STALE_REFRESH_FAILURE_COOLDOWN_MS,
  toProxiedImage,
  type CachedImage,
  type ProxiedImage,
} from './image-proxy-policy';

@Injectable()
export class ImageProxyService implements OnModuleDestroy {
  private readonly cache = new Map<string, CachedImage>();
  private readonly failedFetchUntil = new Map<string, number>();
  private readonly failedStaleRefreshUntil = new Map<string, number>();
  private readonly inFlightFetches = new Map<string, Promise<CachedImage>>();
  private readonly logger = new Logger(ImageProxyService.name);
  private redis: RedisClient | null = null;
  private redisConnectPromise: Promise<RedisClient | null> | null = null;

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async getImage(rawUrl: string | undefined): Promise<ProxiedImage> {
    const url = parseAllowedImageUrl(rawUrl);
    const cacheKey = url.toString();
    const cached = await this.readCache(cacheKey);
    const now = Date.now();

    if (cached && cached.freshUntil > now) {
      return toProxiedImage(cached);
    }

    if (cached && cached.staleUntil > now) {
      this.refreshStaleCacheInBackground(url, cacheKey, now);

      return toProxiedImage(cached);
    }

    if (cached && cached.staleUntil <= now) {
      this.cache.delete(cacheKey);
    }

    const retryAfter = this.failedFetchUntil.get(cacheKey);

    if (retryAfter && retryAfter > now) {
      throw new BadGatewayException('Image provider is temporarily unavailable.');
    }

    if (retryAfter) {
      this.failedFetchUntil.delete(cacheKey);
    }

    try {
      return toProxiedImage(await this.fetchAndCacheImageOnce(url, cacheKey));
    } catch (error) {
      if (cached && cached.staleUntil > now) {
        this.logStaleCacheFallback(url, error);

        return toProxiedImage(cached);
      }

      if (!(error instanceof BadRequestException)) {
        this.failedFetchUntil.set(
          cacheKey,
          Date.now() + FETCH_FAILURE_COOLDOWN_MS,
        );
      }

      throw error;
    }
  }

  private refreshStaleCacheInBackground(url: URL, cacheKey: string, now: number) {
    const retryAfter = this.failedStaleRefreshUntil.get(cacheKey);

    if (retryAfter && retryAfter > now) {
      return;
    }

    void this.fetchAndCacheImageOnce(url, cacheKey)
      .then(() => {
        this.failedStaleRefreshUntil.delete(cacheKey);
      })
      .catch((error) => {
        this.failedStaleRefreshUntil.set(
          cacheKey,
          Date.now() + STALE_REFRESH_FAILURE_COOLDOWN_MS,
        );
        this.logStaleCacheRefreshFailure(url, error);
      });
  }

  private async fetchAndCacheImageOnce(url: URL, cacheKey: string) {
    const existingFetch = this.inFlightFetches.get(cacheKey);

    if (existingFetch) {
      return existingFetch;
    }

    const fetchPromise = this.fetchAndCacheImage(url, cacheKey);
    this.inFlightFetches.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightFetches.delete(cacheKey);
    }
  }

  private async fetchAndCacheImage(url: URL, cacheKey: string) {
    const response = await this.fetchAllowedUrl(url, 0);
    const contentType = getAllowedImageContentType(response);
    const body = await readLimitedImageBody(response);
    const nextCached = buildCachedImage(body, contentType, Date.now());

    await this.writeCache(cacheKey, nextCached);
    this.failedFetchUntil.delete(cacheKey);
    this.failedStaleRefreshUntil.delete(cacheKey);

    return nextCached;
  }

  private async fetchAllowedUrl(
    url: URL,
    redirectCount: number,
  ): Promise<Response> {
    await this.assertPublicNetworkTarget(url);

    let response: Response;

    try {
      response = await fetchExternal(url, {
        allowedHostnameSuffixes: ALLOWED_IMAGE_HOST_SUFFIXES,
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5',
          'user-agent': 'WorkArchiveImageProxy/1.0',
        },
        method: 'GET',
        maxResponseBytes: MAX_IMAGE_BYTES,
        redirect: 'manual',
        timeoutMs: FETCH_TIMEOUT_MS,
      });
    } catch (error) {
      this.logProxyFailure(url, error);
      throw new BadGatewayException('Image provider is unavailable.');
    }

    if (isRedirectStatus(response.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new BadGatewayException('Image provider redirected too many times.');
      }

      const location = response.headers.get('location');

      if (!location) {
        throw new BadGatewayException('Image provider returned an invalid redirect.');
      }

      const nextUrl = new URL(location, url);
      assertAllowedImageUrl(nextUrl);

      return this.fetchAllowedUrl(nextUrl, redirectCount + 1);
    }

    if (!response.ok) {
      throw new BadGatewayException('Image provider returned an error.');
    }

    return response;
  }

  private async assertPublicNetworkTarget(url: URL) {
    try {
      await resolvePublicNetworkAddress(url.hostname);
    } catch (error) {
      if (error instanceof PublicAddressResolutionError) {
        if (error.code === 'private_address') {
          throw new BadRequestException('Image host resolved to a private address.');
        }

        throw new BadGatewayException('Image host could not be resolved.');
      }

      throw error;
    }
  }

  private async readCache(cacheKey: string) {
    const memoryCached = this.cache.get(cacheKey);
    const now = Date.now();

    if (memoryCached?.freshUntil && memoryCached.freshUntil > now) {
      return memoryCached;
    }

    if (memoryCached && memoryCached.staleUntil <= now) {
      this.cache.delete(cacheKey);
    }

    const redis = await this.getRedis();

    if (!redis) {
      return memoryCached?.staleUntil && memoryCached.staleUntil > now
        ? memoryCached
        : undefined;
    }

    try {
      const value = await redis.get(imageRedisKey(cacheKey));

      if (!value) {
        return undefined;
      }

      const cachedImage = deserializeCachedImage(value);

      if (!cachedImage || cachedImage.staleUntil <= now) {
        await redis.del(imageRedisKey(cacheKey));

        return memoryCached?.staleUntil && memoryCached.staleUntil > now
          ? memoryCached
          : undefined;
      }

      this.writeMemoryCache(cacheKey, cachedImage);

      return cachedImage;
    } catch (error) {
      this.logCacheFailure('read', error);

      return memoryCached?.staleUntil && memoryCached.staleUntil > now
        ? memoryCached
        : undefined;
    }
  }

  private async writeCache(cacheKey: string, cachedImage: CachedImage) {
    this.writeMemoryCache(cacheKey, cachedImage);

    const redis = await this.getRedis();

    if (!redis) {
      return;
    }

    try {
      await redis.set(
        imageRedisKey(cacheKey),
        JSON.stringify(serializeCachedImage(cachedImage)),
        'PX',
        Math.max(1, cachedImage.staleUntil - Date.now()),
      );
    } catch (error) {
      this.logCacheFailure('write', error);
    }
  }

  private writeMemoryCache(cacheKey: string, cachedImage: CachedImage) {
    if (this.cache.size >= MAX_MEMORY_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, cachedImage);
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
          this.logCacheFailure('connect', error);

          return null;
        });
    }

    return this.redisConnectPromise;
  }

  private logProxyFailure(url: URL, error: unknown) {
    this.logger.warn({
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      event: 'image_proxy.fetch_failed',
      host: url.hostname,
    });
  }

  private logStaleCacheFallback(url: URL, error: unknown) {
    this.logger.warn({
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      event: 'image_proxy.stale_cache_served',
      host: url.hostname,
    });
  }

  private logStaleCacheRefreshFailure(url: URL, error: unknown) {
    this.logger.warn({
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      event: 'image_proxy.stale_cache_refresh_failed',
      host: url.hostname,
    });
  }

  private logCacheFailure(operation: 'connect' | 'read' | 'write', error: unknown) {
    this.logger.warn({
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      event: 'image_proxy.cache_failed',
      operation,
    });
  }
}
