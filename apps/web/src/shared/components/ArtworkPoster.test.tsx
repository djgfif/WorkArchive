import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { API_BASE_URL, http, HttpResponse, server } from '@test/msw';
import { getCachedPosterImageObjectUrl } from '@shared/services/poster-image-cache';
import { ArtworkPoster } from './ArtworkPoster';
import { clearPosterImageSourceFailuresForTest } from './usePosterImageSource';

const createObjectUrl = vi.fn(() => 'blob:cached-dune');
const revokeObjectUrl = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: createObjectUrl,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: revokeObjectUrl,
});

describe('ArtworkPoster', () => {
  afterEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    clearPosterImageSourceFailuresForTest();
  });

  it('uses lazy async loading for compact poster variants', () => {
    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    const image = screen.getByAltText('Dune 포스터');

    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('uses eager loading for detail poster variants', () => {
    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="detail"
      />,
    );

    expect(screen.getByAltText('Dune 포스터')).toHaveAttribute(
      'loading',
      'eager',
    );
  });

  it('falls back from the image proxy to the original https source', () => {
    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    const image = screen.getByAltText('Dune 포스터');

    expect(image).toHaveAttribute(
      'src',
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );

    fireEvent.error(image);

    expect(screen.getByAltText('Dune 포스터')).toHaveAttribute(
      'src',
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
  });

  it('shows the fallback poster after every image source fails', () => {
    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    fireEvent.error(screen.getByAltText('Dune 포스터'));
    fireEvent.error(screen.getByAltText('Dune 포스터'));

    expect(screen.getByLabelText('Dune 포스터 대체 표지')).toBeInTheDocument();
  });

  it('skips a recently failed proxy source on the next mount', () => {
    const { unmount } = renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    fireEvent.error(screen.getByAltText('Dune 포스터'));
    unmount();

    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    expect(screen.getByAltText('Dune 포스터')).toHaveAttribute(
      'src',
      'https://covers.openlibrary.org/b/id/123-L.jpg',
    );
  });

  it('reuses a locally cached proxy image before trying the external source again', async () => {
    server.use(
      http.get(`${API_BASE_URL}/image-proxy`, () =>
        HttpResponse.text('poster', {
          headers: {
            'content-type': 'image/png',
          },
          status: 200,
        }),
      ),
    );

    const { unmount } = renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    fireEvent.load(screen.getByAltText('Dune 포스터'));

    await waitFor(async () => {
      await expect(
        getCachedPosterImageObjectUrl(
          'https://covers.openlibrary.org/b/id/123-L.jpg',
        ),
      ).resolves.toBe('blob:cached-dune');
    });

    createObjectUrl.mockClear();
    unmount();
    renderWithProviders(
      <ArtworkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    await waitFor(() => {
      expect(screen.getByAltText('Dune 포스터')).toHaveAttribute(
        'src',
        'blob:cached-dune',
      );
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });
});
