import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import * as dns from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
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
const STALE_REFRESH_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
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
  private readonly failedStaleRefreshUntil = new Map<string, number>();
  private readonly inFlightFetches = new Map<string, Promise<CachedImage>>();
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

    if (cached && cached.staleUntil > now) {
      this.refreshStaleCacheInBackground(url, cacheKey, now);

      return this.toProxiedImage(cached);
    }

    if (cached && cached.staleUntil <= now) {
      this.cache.delete(cacheKey);
    }

    try {
      return this.toProxiedImage(await this.fetchAndCacheImageOnce(url, cacheKey));
    } catch (error) {
      if (cached && cached.staleUntil > now) {
        this.logStaleCacheFallback(url, error);

        return this.toProxiedImage(cached);
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
    this.failedStaleRefreshUntil.delete(cacheKey);

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
    if (url.protocol !== 'https:') {
      throw new BadRequestException('Image URL must use HTTPS.');
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

  private async assertPublicNetworkTarget(url: URL) {
    const hostname = url.hostname.trim().toLowerCase();

    if (!hostname || hostname === 'localhost') {
      throw new BadRequestException('Image host is not allowed.');
    }

    const literalIpVersion = isIP(hostname);

    if (literalIpVersion !== 0) {
      if (!this.isPublicIpAddress(hostname, literalIpVersion)) {
        throw new BadRequestException('Image host resolved to a private address.');
      }

      return;
    }

    let addresses: Array<{ address: string; family: number }>;

    try {
      addresses = await dns.lookup(hostname, {
        all: true,
      });
    } catch {
      throw new BadGatewayException('Image host could not be resolved.');
    }

    if (
      addresses.length === 0 ||
      addresses.some(
        ({ address, family }) =>
          !this.isPublicIpAddress(address, family === 6 ? 6 : 4),
      )
    ) {
      throw new BadRequestException('Image host resolved to a private address.');
    }
  }

  private isPublicIpAddress(address: string, family: number) {
    if (family === 4) {
      return this.isPublicIpv4Address(address);
    }

    if (family === 6) {
      return this.isPublicIpv6Address(address);
    }

    return false;
  }

  private isPublicIpv4Address(address: string) {
    const octets = address.split('.').map((part) => Number(part));

    if (
      octets.length !== 4 ||
      octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
    ) {
      return false;
    }

    const [first, second, third] = octets as [number, number, number, number];

    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113)
    );
  }

  private isPublicIpv6Address(address: string) {
    const normalizedAddress = address.toLowerCase();
    const mappedIpv4 = this.readIpv4MappedIpv6Address(normalizedAddress);

    if (mappedIpv4) {
      return this.isPublicIpv4Address(mappedIpv4);
    }

    const expanded = this.expandIpv6Address(normalizedAddress);

    if (!expanded) {
      return false;
    }

    const firstGroup = Number.parseInt(expanded[0]!, 16);
    const secondGroup = Number.parseInt(expanded[1]!, 16);

    return !(
      expanded.every((group) => group === '0000') ||
      expanded.slice(0, 7).every((group) => group === '0000') &&
        expanded[7] === '0001' ||
      (firstGroup & 0xfe00) === 0xfc00 ||
      (firstGroup & 0xffc0) === 0xfe80 ||
      (firstGroup & 0xff00) === 0xff00 ||
      (firstGroup === 0x2001 && secondGroup === 0x0db8)
    );
  }

  private readIpv4MappedIpv6Address(address: string) {
    const marker = '::ffff:';

    if (!address.startsWith(marker)) {
      return null;
    }

    const mappedAddress = address.slice(marker.length);

    return isIP(mappedAddress) === 4 ? mappedAddress : null;
  }

  private expandIpv6Address(address: string) {
    if (!address.includes(':') || address.includes('.')) {
      return null;
    }

    const doubleColonParts = address.split('::');

    if (doubleColonParts.length > 2) {
      return null;
    }

    const left = doubleColonParts[0]
      ? doubleColonParts[0].split(':').filter(Boolean)
      : [];
    const right = doubleColonParts[1]
      ? doubleColonParts[1].split(':').filter(Boolean)
      : [];
    const missingGroups = 8 - left.length - right.length;

    if (missingGroups < 0 || (doubleColonParts.length === 1 && missingGroups !== 0)) {
      return null;
    }

    const groups = [
      ...left,
      ...Array.from({ length: missingGroups }, () => '0'),
      ...right,
    ];

    if (
      groups.length !== 8 ||
      groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))
    ) {
      return null;
    }

    return groups.map((group) => group.padStart(4, '0'));
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
