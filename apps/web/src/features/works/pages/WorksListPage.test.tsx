import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksService } from '../services/works.service';

describe('WorksListPage', () => {
  it('shows filtered and total active counts accurately', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      tier: 'S',
      favorite: false,
    });

    await worksService.createWork({
      type: 'movie',
      title: 'Your Name',
      author: 'Makoto Shinkai',
      genres: ['Drama'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: 4,
      shortReview: '',
      review: '',
      tier: 'A',
      favorite: false,
    });

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText('Showing all 2 saved works in your archive.'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Type$/i), 'novel');

    expect(
      await screen.findByText('Showing 1 of 2 saved works in your archive.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Your Name' }),
    ).not.toBeInTheDocument();
  });
});
