import { render, screen, waitFor } from '@testing-library/react';
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
      await screen.findByText(/작품 2개가 등록되어 있습니다\./),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^유형$/), 'novel');

    expect(
      await screen.findByText(/전체 2개 중 1개를 보고 있습니다\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Your Name' }),
    ).not.toBeInTheDocument();
  });

  it('keeps quick edit for status and rating working in list view', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Frieren',
      author: 'Kanehito Yamada',
      genres: ['Fantasy'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
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

    await screen.findByRole('link', { name: 'Frieren' });

    await user.selectOptions(screen.getByLabelText('Frieren 상태'), 'completed');
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Frieren 상태') as HTMLSelectElement).value,
      ).toBe('completed');
    });

    await user.selectOptions(screen.getByLabelText('Frieren 별점'), '4.5');
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Frieren 별점') as HTMLSelectElement).value,
      ).toBe('4.5');
    });
  });
});
