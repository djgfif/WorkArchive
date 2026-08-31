import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { WorkPoster } from './ArchiveComponents';

describe('WorkPoster', () => {
  it('uses the shared lazy loading policy for row posters', () => {
    renderWithProviders(
      <WorkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    const image = screen.getByAltText('Dune 포스터');

    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('uses the shared eager loading policy for hero posters', () => {
    renderWithProviders(
      <WorkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="hero"
      />,
    );

    expect(screen.getByAltText('Dune 포스터')).toHaveAttribute(
      'loading',
      'eager',
    );
  });

  it('uses the shared private-first proxy failure policy', () => {
    renderWithProviders(
      <WorkPoster
        thumbnailUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
        variant="row"
      />,
    );

    fireEvent.error(screen.getByAltText('Dune 포스터'));

    expect(screen.getByLabelText('Dune 포스터 대체 표지')).toBeInTheDocument();
    expect(screen.queryByAltText('Dune 포스터')).not.toBeInTheDocument();
  });
});
