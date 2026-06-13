import { describe, expect, it } from 'vitest';

import { getDisplayImageUrl, getDisplayImageUrlCandidates } from './image-proxy';

describe('getDisplayImageUrl', () => {
  it('routes known external image hosts through the same-origin image proxy', () => {
    expect(
      getDisplayImageUrl('https://covers.openlibrary.org/b/id/123-L.jpg'),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
    expect(
      getDisplayImageUrl(
        'https://archive.org/download/olcovers1/olcovers1-L.zip/123-L.jpg',
      ),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Farchive.org%2Fdownload%2Folcovers1%2Folcovers1-L.zip%2F123-L.jpg',
    );
    expect(getDisplayImageUrl('https://s4.anilist.co/file/cover.jpg')).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fs4.anilist.co%2Ffile%2Fcover.jpg',
    );
  });

  it('upgrades known http image URLs before sending them to the hardened image proxy', () => {
    expect(
      getDisplayImageUrl('http://books.google.com/books/content?id=dune'),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fbooks.google.com%2Fbooks%2Fcontent%3Fid%3Ddune',
    );
  });

  it('normalizes protocol-relative known image URLs as https proxy candidates', () => {
    expect(
      getDisplayImageUrl('//covers.openlibrary.org/b/id/123-L.jpg'),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
  });

  it('strips credentials and fragments before building same-origin proxy URLs', () => {
    expect(
      getDisplayImageUrl(
        'https://user:secret@covers.openlibrary.org/b/id/123-L.jpg#private',
      ),
    ).toBe(
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
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

  it('does not treat non-cover AniList endpoints as proxy image hosts', () => {
    expect(getDisplayImageUrl('https://graphql.anilist.co')).toBe(
      'https://graphql.anilist.co',
    );
  });
});
