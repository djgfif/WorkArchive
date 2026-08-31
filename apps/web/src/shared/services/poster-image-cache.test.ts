import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cachePosterImageFromDisplaySource,
  clearPosterImageCache,
  getCachedPosterImageObjectUrl,
  isPosterImageCacheExpired,
  POSTER_IMAGE_CACHE_MAX_AGE_MS,
} from './poster-image-cache';

const createObjectUrl = vi.fn(() => 'blob:cached-poster');

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: createObjectUrl,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
});

describe('poster image cache', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    createObjectUrl.mockClear();
    await clearPosterImageCache();
  });

  it('stores successful same-origin image proxy responses as local blobs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('poster', {
            headers: {
              'content-type': 'image/png',
            },
            status: 200,
          }),
      ),
    );

    cachePosterImageFromDisplaySource(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );

    await expect
      .poll(() =>
        getCachedPosterImageObjectUrl(
          'https://covers.openlibrary.org/b/id/123-L.jpg',
        ),
      )
      .toBe('blob:cached-poster');
    expect(fetch).toHaveBeenCalledWith(
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
      {
        cache: 'force-cache',
        credentials: 'same-origin',
        referrerPolicy: 'no-referrer',
      },
    );
  });

  it('expires locally cached poster images only after 30 days', () => {
    const cachedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date(cachedAt).toISOString();

    expect(
      isPosterImageCacheExpired(
        updatedAt,
        cachedAt + POSTER_IMAGE_CACHE_MAX_AGE_MS,
      ),
    ).toBe(false);
    expect(
      isPosterImageCacheExpired(
        updatedAt,
        cachedAt + POSTER_IMAGE_CACHE_MAX_AGE_MS + 1,
      ),
    ).toBe(true);
    expect(isPosterImageCacheExpired('invalid timestamp', cachedAt)).toBe(true);
  });

  it('does not fetch arbitrary external image URLs for caching', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    cachePosterImageFromDisplaySource(
      'https://cdn.example.test/cover.jpg',
      'https://cdn.example.test/cover.jpg',
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      getCachedPosterImageObjectUrl('https://cdn.example.test/cover.jpg'),
    ).resolves.toBeNull();
  });
});
