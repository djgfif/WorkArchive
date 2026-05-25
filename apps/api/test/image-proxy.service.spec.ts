import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

describe('ImageProxyService', () => {
  let service: ImageProxyService;

  beforeEach(() => {
    service = new ImageProxyService();
    jest.restoreAllMocks();
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
});
