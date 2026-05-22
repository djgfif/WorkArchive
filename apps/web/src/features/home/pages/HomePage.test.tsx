import { screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth';
import { worksService } from '../../works';

describe('HomePage', () => {
  it('shows series and contributor shelves before continue watching', async () => {
    await worksService.createWork({
      type: 'anime',
      title: 'Fate/stay night',
      author: 'TYPE-MOON',
      genres: ['Fantasy'],
      personalTags: ['series:Fate', 'studio:ufotable'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      favorite: false,
    });

    await worksService.createWork({
      type: 'anime',
      title: 'Fate/Zero',
      author: 'Gen Urobuchi',
      genres: ['Fantasy'],
      personalTags: ['series:Fate', 'studio:ufotable'],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: 4,
      shortReview: '',
      review: '',
      favorite: false,
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    const seriesHeading = await screen.findByText('시리즈 컬렉션');
    const contributorHeading = screen.getByText('제작진으로 보기');
    const continueHeading = screen.getByText('보는 중인 작품');

    expect(
      seriesHeading.compareDocumentPosition(contributorHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      contributorHeading.compareDocumentPosition(continueHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === '/works?series=Fate'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link')
        .some(
          (link) => link.getAttribute('href') === '/works?contributor=ufotable',
        ),
    ).toBe(true);
  });

  it('shows the shared JSON backup reminder after 20 works without a backup', async () => {
    for (let index = 0; index < 20; index += 1) {
      await worksService.createWork({
        type: 'novel',
        title: `Backup Reminder Work ${index + 1}`,
        author: '',
        genres: [],
        personalTags: [],
        description: '',
        thumbnailUrl: '',
        status: 'planned',
        rating: null,
        shortReview: '',
        review: '',
        favorite: false,
      });
    }

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText('첫 JSON 백업을 권장합니다'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
  });
});
