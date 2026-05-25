import { describe, expect, it } from 'vitest';

import { getDisplayImageUrl, getDisplayImageUrlCandidates } from './image-proxy';

describe('getDisplayImageUrl', () => {
  it('routes known external image hosts through the same-origin image proxy', () => {
    expect(
      getDisplayImageUrl('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
  });

  it('does not route http image URLs through the hardened image proxy', () => {
    expect(
      getDisplayImageUrl('http://books.google.com/books/content?id=dune'),
    ).toBe('http://books.google.com/books/content?id=dune');
  });

  it('keeps local and unknown https image URLs direct', () => {
    expect(getDisplayImageUrl('/cover.jpg')).toBe('/cover.jpg');
    expect(getDisplayImageUrl('https://cdn.example.test/cover.jpg')).toBe(
      'https://cdn.example.test/cover.jpg',
    );
  });

  it('does not send unknown http hosts to the allowlisted image proxy', () => {
    expect(getDisplayImageUrl('http://cdn.example.test/cover.jpg')).toBe(
      'http://cdn.example.test/cover.jpg',
    );
  });

  it('provides direct https fallback candidates for proxied hosts', () => {
    expect(
      getDisplayImageUrlCandidates('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).toEqual([
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    ]);
  });
});
