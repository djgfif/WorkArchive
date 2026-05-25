import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

import { fetchExternal } from '../../common/external-fetch';
import { readApiRuntimeConfig } from '../../config/api-runtime-config';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FRESH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REDIS_CACHE_TTL_MS = FRESH_CACHE_TTL_MS + STALE_CACHE_TTL_MS;
const MAX_MEMORY_CACHE_ENTRIES = 500;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
const REDIS_KEY_PREFIX = 'work-archive:image-proxy:';
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'anilist.co',
  'books.google.com',
  'covers.openlibrary.org',
  'daumcdn.net',
  'googleusercontent.com',
  'image.aladin.co.kr',
  'image.tmdb.org',
  'kakaocdn.net',
  'pstatic.net',
  'static.tvmaze.com',
  'wikimedia.org',
] as const;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface CachedImage {
  body: Buffer;
  contentType: string;
  etag: string;
  freshUntil: number;
  staleUntil: number;
}

interface SerializedCachedImage {
  bodyBase64: string;
  contentType: string;
  etag: string;
  freshUntil: number;
  staleUntil: number;
}

export interface ProxiedImage {
  body: Buffer;
  cacheControl: string;
  contentType: string;
  etag: string;
}

@Injectable()
export class ImageProxyService implements OnModuleDestroy {
  private readonly cache = new Map<string, CachedImage>();
  private readonly logger = new Logger(ImageProxyService.name);
  private redis: Redis | null = null;
  private redisConnectPromise: Promise<Redis | null> | null = null;

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async getImage(rawUrl: string | undefined): Promise<ProxiedImage> {
    const url = this.parseAllowedUrl(rawUrl);
    const cacheKey = url.toString();
    const cached = await this.readCache(cacheKey);
    const now = Date.now();

    if (cached && cached.freshUntil > now) {
      return this.toProxiedImage(cached);
    }

    if (cached && cached.staleUntil <= now) {
      this.cache.delete(cacheKey);
    }

    try {
      return this.toProxiedImage(await this.fetchAndCacheImage(url, cacheKey));
    } catch (error) {
      if (cached && cached.staleUntil > now) {
        this.logStaleCacheFallback(url, error);

        return this.toProxiedImage(cached);
      }

      throw error;
    }
  }

  private async fetchAndCacheImage(url: URL, cacheKey: string) {
    const response = await this.fetchAllowedUrl(url, 0);
    const contentType = this.getAllowedContentType(response);
    const body = await this.readImageBody(response);
    const now = Date.now();
    const nextCached = {
      body,
      contentType,
      etag: `"${createHash('sha256').update(body).digest('hex')}"`,
      freshUntil: now + FRESH_CACHE_TTL_MS,
      staleUntil: now + REDIS_CACHE_TTL_MS,
    };

    await this.writeCache(cacheKey, nextCached);

    return nextCached;
  }

  private parseAllowedUrl(rawUrl: string | undefined) {
    const normalized = rawUrl?.trim();

    if (!normalized) {
      throw new BadRequestException('Image URL is required.');
    }

    if (normalized.length > 4096) {
      throw new BadRequestException('Image URL is too long.');
    }

    let url: URL;

    try {
      url = new URL(normalized);
    } catch {
      throw new BadRequestException('Image URL is invalid.');
    }

    this.assertAllowedUrl(url);

    url.hash = '';
    url.username = '';
    url.password = '';

    return url;
  }

  private assertAllowedUrl(url: URL) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Image URL must use HTTP or HTTPS.');
    }

    if (!this.isAllowedImageHost(url.hostname)) {
      throw new BadRequestException('Image host is not allowed.');
    }
  }

  private isAllowedImageHost(hostname: string) {
    const normalizedHostname = hostname.toLowerCase();

    return ALLOWED_IMAGE_HOST_SUFFIXES.some(
      (suffix) =>
        normalizedHostname === suffix ||
        normalizedHostname.endsWith(`.${suffix}`),
    );
  }

  private async fetchAllowedUrl(
    url: URL,
    redirectCount: number,
  ): Promise<Response> {
    let response: Response;

    try {
      response = await fetchExternal(url, {
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5',
          'user-agent': 'WorkArchiveImageProxy/1.0',
        },
        method: 'GET',
        redirect: 'manual',
        timeoutMs: FETCH_TIMEOUT_MS,
      });
    } catch (error) {
      this.logProxyFailure(url, error);
      throw new BadGatewayException('Image provider is unavailable.');
    }

    if (this.isRedirect(response.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new BadGatewayException('Image provider redirected too many times.');
      }

      const location = response.headers.get('location');

      if (!location) {
        throw new BadGatewayException('Image provider returned an invalid redirect.');
      }

      const nextUrl = new URL(location, url);
      this.assertAllowedUrl(nextUrl);

      return this.fetchAllowedUrl(nextUrl, redirectCount + 1);
    }

    if (!response.ok) {
      throw new BadGatewayException('Image provider returned an error.');
    }

    return response;
  }

  private isRedirect(status: number) {
    return status >= 300 && status < 400;
  }

  private getAllowedContentType(response: Response) {
    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadGatewayException('Image provider returned an unsupported image type.');
    }

    return contentType;
  }

  private async readImageBody(response: Response) {
    const contentLength = response.headers.get('content-length');
    const parsedContentLength = contentLength ? Number(contentLength) : null;

    if (
      parsedContentLength !== null &&
      Number.isFinite(parsedContentLength) &&
      parsedContentLength > MAX_IMAGE_BYTES
    ) {
      throw new BadGatewayException('Image is too large.');
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new BadGatewayException('Image is too large.');
    }

    return Buffer.from(arrayBuffer);
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
      const value = await redis.get(this.redisKey(cacheKey));

      if (!value) {
        return undefined;
      }

      const cachedImage = this.deserializeCachedImage(value);

      if (!cachedImage || cachedImage.staleUntil <= now) {
        await redis.del(this.redisKey(cacheKey));

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
        this.redisKey(cacheKey),
        JSON.stringify(this.serializeCachedImage(cachedImage)),
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

  private serializeCachedImage(
    cachedImage: CachedImage,
  ): SerializedCachedImage {
    return {
      bodyBase64: cachedImage.body.toString('base64'),
      contentType: cachedImage.contentType,
      etag: cachedImage.etag,
      freshUntil: cachedImage.freshUntil,
      staleUntil: cachedImage.staleUntil,
    };
  }

  private deserializeCachedImage(value: string): CachedImage | null {
    try {
      const parsed = JSON.parse(value) as Partial<SerializedCachedImage>;

      if (
        !parsed.bodyBase64 ||
        !parsed.contentType ||
        !parsed.etag ||
        typeof parsed.freshUntil !== 'number' ||
        typeof parsed.staleUntil !== 'number' ||
        !ALLOWED_CONTENT_TYPES.has(parsed.contentType)
      ) {
        return null;
      }

      return {
        body: Buffer.from(parsed.bodyBase64, 'base64'),
        contentType: parsed.contentType,
        etag: parsed.etag,
        freshUntil: parsed.freshUntil,
        staleUntil: parsed.staleUntil,
      };
    } catch {
      return null;
    }
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
          this.logCacheFailure('connect', error);

          return null;
        });
    }

    return this.redisConnectPromise;
  }

  private redisKey(cacheKey: string) {
    return `${REDIS_KEY_PREFIX}${createHash('sha256').update(cacheKey).digest('hex')}`;
  }

  private toProxiedImage(cachedImage: CachedImage): ProxiedImage {
    return {
      body: cachedImage.body,
      cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
      contentType: cachedImage.contentType,
      etag: cachedImage.etag,
    };
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

  private logCacheFailure(operation: 'connect' | 'read' | 'write', error: unknown) {
    this.logger.warn({
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      event: 'image_proxy.cache_failed',
      operation,
    });
  }
}
