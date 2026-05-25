import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ImageProxyService } from '../src/modules/image-proxy/image-proxy.service';

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
    service = new ImageProxyService();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches and caches allowed provider images with production cache headers', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(imageResponse('image-body'));

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
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockReturnValue(deferred.promise);

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

  it('rejects untrusted hosts before fetching', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.getImage('https://internal.example.test/cover.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates redirect targets against the image host allowlist', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
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

  it('rejects non-image upstream responses', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
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

  it('serves stale cached images immediately while refreshing in the background', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-25T00:00:00.000Z'));

    const refresh = createDeferred<Response>();
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
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

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
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
