import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { fetchExternal } from '../../common/external-fetch';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
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
  expiresAt: number;
}

export interface ProxiedImage {
  body: Buffer;
  cacheControl: string;
  contentType: string;
  etag: string;
}

@Injectable()
export class ImageProxyService {
  private readonly cache = new Map<string, CachedImage>();
  private readonly logger = new Logger(ImageProxyService.name);

  async getImage(rawUrl: string | undefined): Promise<ProxiedImage> {
    const url = this.parseAllowedUrl(rawUrl);
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return this.toProxiedImage(cached);
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    const response = await this.fetchAllowedUrl(url, 0);
    const contentType = this.getAllowedContentType(response);
    const body = await this.readImageBody(response);
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    const nextCached = {
      body,
      contentType,
      etag,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    this.writeCache(cacheKey, nextCached);

    return this.toProxiedImage(nextCached);
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

  private writeCache(cacheKey: string, cachedImage: CachedImage) {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, cachedImage);
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
}
