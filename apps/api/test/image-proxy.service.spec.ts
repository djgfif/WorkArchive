import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { setExternalFetchTransportForTest } from '../src/common/external-fetch';
import { ImageProxyService } from '../src/modules/image-proxy/image-proxy.service';
import {
  MAX_HOST_CONCURRENT_FETCHES,
  MAX_HOST_FETCHES_PER_WINDOW,
  MAX_IMAGE_BYTES,
  MAX_MEMORY_CACHE_BYTES,
} from '../src/modules/image-proxy/image-proxy-policy';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const lookupMock = lookup as unknown as jest.Mock;
let upstreamFetchMock: jest.MockedFunction<() => Promise<Response>>;

function imageResponse(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    headers: {
      'content-type': 'image/jpeg',
      ...headers,
    },
    status: 200,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe('ImageProxyService', () => {
  let service: ImageProxyService;

  beforeEach(() => {
    jest.restoreAllMocks();
    upstreamFetchMock = jest.fn(async () => imageResponse('image-body'));
    setExternalFetchTransportForTest(() => upstreamFetchMock());
    lookupMock.mockResolvedValue([
      {
        address: '93.184.216.34',
        family: 4,
      },
    ] as never);
    service = new ImageProxyService();
    jest.useRealTimers();
  });

  afterEach(() => {
    setExternalFetchTransportForTest(null);
    jest.useRealTimers();
  });

  it('fetches and caches allowed provider images with production cache headers', async () => {
    const fetchSpy = upstreamFetchMock.mockResolvedValue(
      imageResponse('image-body'),
    );

    const first = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
    const second = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    expect(first.contentType).toBe('image/jpeg');
    expect(first.cacheControl).toContain('max-age=86400');
    expect(first.body.toString()).toBe('image-body');
    expect(second.etag).toBe(first.etag);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent fetches for the same image URL', async () => {
    const deferred = createDeferred<Response>();
    const fetchSpy = upstreamFetchMock.mockReturnValue(deferred.promise);

    const first = service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
    const second = service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    deferred.resolve(imageResponse('shared-image'));

    await expect(first).resolves.toMatchObject({
      contentType: 'image/jpeg',
    });
    await expect(second).resolves.toMatchObject({
      contentType: 'image/jpeg',
    });
    expect((await first).body.toString()).toBe('shared-image');
    expect((await second).body.toString()).toBe('shared-image');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('evicts cached images by byte budget, not only entry count', async () => {
    const largeImageBody = 'x'.repeat(MAX_IMAGE_BYTES);
    const imageCountPastByteBudget =
      Math.floor(MAX_MEMORY_CACHE_BYTES / MAX_IMAGE_BYTES) + 1;

    upstreamFetchMock.mockImplementation(async () =>
      imageResponse(largeImageBody),
    );

    for (let index = 0; index < imageCountPastByteBudget; index += 1) {
      await service.getImage(
        `https://covers.openlibrary.org/b/id/large-${index}-L.jpg`,
      );
    }

    expect(upstreamFetchMock).toHaveBeenCalledTimes(imageCountPastByteBudget);

    await service.getImage('https://covers.openlibrary.org/b/id/large-0-L.jpg');

    expect(upstreamFetchMock).toHaveBeenCalledTimes(
      imageCountPastByteBudget + 1,
    );
  });

  it('cools down repeated failed fetches for the same image URL', async () => {
    upstreamFetchMock.mockResolvedValue(
      new Response(null, {
        status: 502,
      }),
    );

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/missing-L.jpg'),
    ).rejects.toThrow('Image provider returned an error.');
    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/missing-L.jpg'),
    ).rejects.toThrow('temporarily unavailable');
    expect(upstreamFetchMock).toHaveBeenCalledTimes(1);
  });

  it('limits cache-miss fetches per image host without blocking cache hits', async () => {
    await service.getImage('https://covers.openlibrary.org/b/id/cached-L.jpg');

    for (let index = 0; index < MAX_HOST_FETCHES_PER_WINDOW - 1; index += 1) {
      const cached = await service.getImage(
        'https://covers.openlibrary.org/b/id/cached-L.jpg',
      );

      expect(cached.body.toString()).toBe('image-body');
    }

    for (let index = 0; index < MAX_HOST_FETCHES_PER_WINDOW - 1; index += 1) {
      await service.getImage(
        `https://covers.openlibrary.org/b/id/miss-${index}-L.jpg`,
      );
    }

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/limited-L.jpg'),
    ).rejects.toThrow('fetch limit exceeded');
  });

  it('limits concurrent upstream fetches per image host', async () => {
    const deferred = createDeferred<void>();
    upstreamFetchMock.mockImplementation(async () => {
      await deferred.promise;

      return imageResponse('released-image');
    });

    const pending = Array.from(
      { length: MAX_HOST_CONCURRENT_FETCHES },
      (_, index) =>
        service.getImage(
          `https://covers.openlibrary.org/b/id/concurrent-${index}-L.jpg`,
        ),
    );

    await Promise.resolve();
    await Promise.resolve();

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/overflow-L.jpg'),
    ).rejects.toThrow('too many concurrent requests');

    deferred.resolve();

    await expect(Promise.all(pending)).resolves.toHaveLength(
      MAX_HOST_CONCURRENT_FETCHES,
    );
  });

  it('rejects untrusted hosts before fetching', async () => {
    await expect(
      service.getImage('https://internal.example.test/cover.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it('rejects http image URLs before fetching', async () => {
    await expect(
      service.getImage('http://books.google.com/books/content?id=dune'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'https://localhost/cover.jpg',
    'https://127.0.0.1/cover.jpg',
    'https://10.0.0.1/cover.jpg',
    'https://172.16.0.1/cover.jpg',
    'https://192.168.0.1/cover.jpg',
    'https://169.254.169.254/cover.jpg',
    'https://[::1]/cover.jpg',
    'https://[fc00::1]/cover.jpg',
    'https://[::ffff:192.168.0.1]/cover.jpg',
  ])('rejects local or private image host %s before fetching', async (url) => {
    await expect(service.getImage(url)).rejects.toBeInstanceOf(BadRequestException);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it('rejects allowlisted hosts that resolve to private addresses', async () => {
    lookupMock.mockResolvedValue([
      {
        address: '10.0.0.5',
        family: 4,
      },
    ] as never);

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it('rejects allowlisted hosts that resolve to IPv4-mapped private IPv6 addresses', async () => {
    lookupMock.mockResolvedValue([
      {
        address: '::ffff:192.168.0.5',
        family: 6,
      },
    ] as never);

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upstreamFetchMock).not.toHaveBeenCalled();
  });

  it('validates redirect targets against the image host allowlist', async () => {
    upstreamFetchMock.mockResolvedValue(
      new Response(null, {
        headers: {
          location: 'https://internal.example.test/cover.jpg',
        },
        status: 302,
      }),
    );

    await expect(
      service.getImage('https://books.google.com/books/content?id=dune'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows OpenLibrary cover redirects to archive.org image files', async () => {
    upstreamFetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            location:
              'https://archive.org/download/olcovers1/olcovers1-L.zip/123-L.jpg',
          },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(imageResponse('archive-cover'));

    const image = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    expect(image.body.toString()).toBe('archive-cover');
    expect(upstreamFetchMock).toHaveBeenCalledTimes(2);
  });

  it('validates redirect target DNS against private addresses', async () => {
    lookupMock
      .mockResolvedValueOnce([
        {
          address: '93.184.216.34',
          family: 4,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          address: '192.168.0.5',
          family: 4,
        },
      ] as never);
    upstreamFetchMock.mockResolvedValue(
      new Response(null, {
        headers: {
          location: 'https://covers.openlibrary.org/private.jpg',
        },
        status: 302,
      }),
    );

    await expect(
      service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-image upstream responses', async () => {
    upstreamFetchMock.mockResolvedValue(
      new Response('<html></html>', {
        headers: {
          'content-type': 'text/html',
        },
        status: 200,
      }),
    );

    await expect(
      service.getImage('https://books.google.com/books/content?id=dune'),
    ).rejects.toThrow('unsupported image type');
  });

  it('rejects SVG upstream responses', async () => {
    upstreamFetchMock.mockResolvedValue(
      new Response('<svg></svg>', {
        headers: {
          'content-type': 'image/svg+xml',
        },
        status: 200,
      }),
    );

    await expect(
      service.getImage('https://books.google.com/books/content?id=dune'),
    ).rejects.toThrow('unsupported image type');
  });

  it('rejects oversized upstream responses by content length', async () => {
    upstreamFetchMock.mockResolvedValue(
      imageResponse('', {
        'content-length': String(8 * 1024 * 1024 + 1),
      }),
    );

    await expect(
      service.getImage('https://books.google.com/books/content?id=dune'),
    ).rejects.toThrow('too large');
  });

  it('serves stale cached images immediately while refreshing in the background', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-25T00:00:00.000Z'));

    const refresh = createDeferred<Response>();
    const fetchSpy = upstreamFetchMock
      .mockResolvedValueOnce(imageResponse('cached-image'))
      .mockReturnValueOnce(refresh.promise);

    const first = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    jest.setSystemTime(new Date('2026-05-27T00:00:00.000Z'));

    const stale = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
    const duplicateStale = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    expect(first.body.toString()).toBe('cached-image');
    expect(stale.body.toString()).toBe('cached-image');
    expect(duplicateStale.body.toString()).toBe('cached-image');
    expect(stale.etag).toBe(first.etag);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    refresh.resolve(imageResponse('refreshed-image'));
    await jest.runAllTimersAsync();

    const refreshed = await service.getImage(
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );

    expect(refreshed.body.toString()).toBe('refreshed-image');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('backs off failed stale refresh attempts', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-25T00:00:00.000Z'));

    const fetchSpy = upstreamFetchMock
      .mockResolvedValueOnce(imageResponse('cached-image'))
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce(imageResponse('refreshed-image'));

    await service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg');

    jest.setSystemTime(new Date('2026-05-27T00:00:00.000Z'));

    await service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg');
    await jest.runAllTimersAsync();

    await service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg');

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    jest.setSystemTime(new Date('2026-05-27T00:06:00.000Z'));

    await service.getImage('https://covers.openlibrary.org/b/id/123-L.jpg');
    await jest.runAllTimersAsync();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
