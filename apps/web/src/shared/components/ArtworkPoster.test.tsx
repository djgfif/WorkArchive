import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { ArtworkPoster } from './ArtworkPoster';

describe('ArtworkPoster', () => {
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
});
