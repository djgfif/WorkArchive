import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import {
  buildCachedImage,
  deserializeCachedImage,
  FRESH_CACHE_TTL_MS,
  getAllowedImageContentType,
  imageRedisKey,
  isAllowedImageHost,
  isRedirectStatus,
  parseAllowedImageUrl,
  readLimitedImageBody,
  REDIS_CACHE_TTL_MS,
  serializeCachedImage,
  toProxiedImage,
} from '../src/modules/image-proxy/image-proxy-policy';

function responseWithBody(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    headers,
    status: 200,
  });
}

describe('image proxy policy', () => {
  it('normalizes allowed image URLs and strips credentials and fragments', () => {
    const url = parseAllowedImageUrl(
      '  https://user:pass@covers.openlibrary.org/b/id/123-L.jpg#secret  ',
    );

    expect(url.toString()).toBe(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
    expect(isAllowedImageHost('cdn.covers.openlibrary.org')).toBe(true);
    expect(isAllowedImageHost('covers.openlibrary.org.evil.example')).toBe(false);
  });

  it('rejects missing, invalid, non-https, and untrusted URLs', () => {
    expect(() => parseAllowedImageUrl(undefined)).toThrow(BadRequestException);
    expect(() => parseAllowedImageUrl('not a url')).toThrow(BadRequestException);
    expect(() =>
      parseAllowedImageUrl('http://covers.openlibrary.org/b/id/123-L.jpg'),
    ).toThrow(BadRequestException);
    expect(() =>
      parseAllowedImageUrl('https://internal.example.test/cover.jpg'),
    ).toThrow(BadRequestException);
  });

  it('detects redirect status codes', () => {
    expect(isRedirectStatus(299)).toBe(false);
    expect(isRedirectStatus(300)).toBe(true);
    expect(isRedirectStatus(302)).toBe(true);
    expect(isRedirectStatus(399)).toBe(true);
    expect(isRedirectStatus(400)).toBe(false);
  });

  it('accepts only supported image content types', () => {
    expect(
      getAllowedImageContentType(
        responseWithBody('body', {
          'content-type': 'Image/WebP; charset=binary',
        }),
      ),
    ).toBe('image/webp');
    expect(() =>
      getAllowedImageContentType(
        responseWithBody('body', {
          'content-type': 'image/svg+xml',
        }),
      ),
    ).toThrow(BadGatewayException);
  });

  it('rejects oversized image bodies from content length', async () => {
    await expect(
      readLimitedImageBody(
        responseWithBody('', {
          'content-length': String(8 * 1024 * 1024 + 1),
        }),
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  it('builds, serializes, and deserializes cache entries', () => {
    const body = Buffer.from('image-body');
    const now = Date.parse('2026-06-12T00:00:00.000Z');
    const cached = buildCachedImage(body, 'image/jpeg', now);

    expect(cached).toMatchObject({
      body,
      contentType: 'image/jpeg',
      freshUntil: now + FRESH_CACHE_TTL_MS,
      staleUntil: now + REDIS_CACHE_TTL_MS,
    });
    expect(cached.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(deserializeCachedImage(JSON.stringify(serializeCachedImage(cached)))).toEqual(
      cached,
    );
    expect(
      deserializeCachedImage(
        JSON.stringify({
          bodyBase64: body.toString('base64'),
          contentType: 'image/svg+xml',
          etag: cached.etag,
          freshUntil: cached.freshUntil,
          staleUntil: cached.staleUntil,
        }),
      ),
    ).toBeNull();
  });

  it('builds stable Redis keys and proxied image responses', () => {
    const cacheKey = 'https://covers.openlibrary.org/b/id/123-L.jpg';
    const cached = buildCachedImage(Buffer.from('image-body'), 'image/png', 0);

    expect(imageRedisKey(cacheKey)).toMatch(
      /^work-archive:image-proxy:[a-f0-9]{64}$/,
    );
    expect(imageRedisKey(cacheKey)).toBe(imageRedisKey(cacheKey));
    expect(toProxiedImage(cached)).toEqual({
      body: cached.body,
      cacheControl: 'public, max-age=86400, stale-while-revalidate=604800',
      contentType: 'image/png',
      etag: cached.etag,
    });
  });
});
