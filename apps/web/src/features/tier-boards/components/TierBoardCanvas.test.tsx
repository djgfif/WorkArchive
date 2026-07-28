import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { CardImage } from './TierBoardCanvas';

describe('CardImage poster privacy', () => {
  it('renders allowlisted covers only through the same-origin proxy', () => {
    renderWithProviders(
      <CardImage
        imageUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
      />,
    );

    const image = screen.getByAltText('Dune');

    expect(image).toHaveAttribute(
      'src',
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('uses the local placeholder for arbitrary hosts and proxy failures', () => {
    const { unmount } = renderWithProviders(
      <CardImage
        imageUrl="https://cdn.example.test/track-user.jpg"
        title="Dune"
      />,
    );

    expect(screen.queryByAltText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();

    unmount();
    renderWithProviders(
      <CardImage
        imageUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
      />,
    );
    fireEvent.error(screen.getByAltText('Dune'));

    expect(screen.queryByAltText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});
