import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const FRESH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REDIS_CACHE_TTL_MS = FRESH_CACHE_TTL_MS + STALE_CACHE_TTL_MS;
export const MAX_MEMORY_CACHE_ENTRIES = 500;
export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 5000;
export const FETCH_FAILURE_COOLDOWN_MS = 60 * 1000;
export const STALE_REFRESH_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
export const REDIS_KEY_PREFIX = 'work-archive:image-proxy:';

export const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'archive.org',
  'books.google.com',
  'covers.openlibrary.org',
  'daumcdn.net',
  'googleusercontent.com',
  'image.aladin.co.kr',
  'image.tmdb.org',
  'kakaocdn.net',
  'pstatic.net',
  's4.anilist.co',
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

export interface CachedImage {
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

export function parseAllowedImageUrl(rawUrl: string | undefined) {
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

  assertAllowedImageUrl(url);

  url.hash = '';
  url.username = '';
  url.password = '';

  return url;
}

export function assertAllowedImageUrl(url: URL) {
  if (url.protocol !== 'https:') {
    throw new BadRequestException('Image URL must use HTTPS.');
  }

  if (!isAllowedImageHost(url.hostname)) {
    throw new BadRequestException('Image host is not allowed.');
  }
}

export function isAllowedImageHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) =>
      normalizedHostname === suffix ||
      normalizedHostname.endsWith(`.${suffix}`),
  );
}

export function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

export function getAllowedImageContentType(response: Response) {
  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new BadGatewayException(
      'Image provider returned an unsupported image type.',
    );
  }

  return contentType;
}

export async function readLimitedImageBody(response: Response) {
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

export function buildCachedImage(
  body: Buffer,
  contentType: string,
  now: number,
): CachedImage {
  return {
    body,
    contentType,
    etag: `"${createHash('sha256').update(body).digest('hex')}"`,
    freshUntil: now + FRESH_CACHE_TTL_MS,
    staleUntil: now + REDIS_CACHE_TTL_MS,
  };
}

export function serializeCachedImage(
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

export function deserializeCachedImage(value: string): CachedImage | null {
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

export function imageRedisKey(cacheKey: string) {
  return `${REDIS_KEY_PREFIX}${createHash('sha256').update(cacheKey).digest('hex')}`;
}

export function toProxiedImage(cachedImage: CachedImage): ProxiedImage {
  return {
    body: cachedImage.body,
    cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
    contentType: cachedImage.contentType,
    etag: cachedImage.etag,
  };
}
