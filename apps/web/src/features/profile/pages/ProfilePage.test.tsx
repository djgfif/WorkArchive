import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { findLinkByHref, getLinkByHref } from '../../../test/ui-helpers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksRepository } from '../../works/services/works.repository';
import { worksService } from '../../works/services/works.service';

describe('ProfilePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders profile entry actions without public profile links', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/profile'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await findLinkByHref('/works/new')).toBeInTheDocument();
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(screen.queryByText('공개 소개')).not.toBeInTheDocument();
    expect(screen.queryByText('공개 리스트')).not.toBeInTheDocument();
    expect(screen.queryByText('공개 프로필')).not.toBeInTheDocument();
  });

  it('surfaces recent private records as continue actions', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Older Profile Work',
      author: 'Archive Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const recentWork = await worksService.createWork({
      type: 'movie',
      title: 'Recent Profile Work',
      author: 'Daily Viewer',
      genres: ['Drama'],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: 4,
      shortReview: '',
      review: '',
      tier: null,
      favorite: true,
    });
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/profile'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('link', { name: /Recent Profile Work/ }),
    ).toHaveAttribute('href', `/works/${recentWork.id}`);
    expect(screen.getByRole('link', { name: '이어 기록하기' })).toHaveAttribute(
      'href',
      `/works/${recentWork.id}`,
    );
  });

  it('offers recovery actions when the private record summary cannot load', async () => {
    const user = userEvent.setup();
    const listActiveSpy = vi
      .spyOn(worksRepository, 'listActive')
      .mockRejectedValueOnce(new Error('IndexedDB 연결 실패'));
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/profile'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(getLinkByHref('/works/new')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    await waitFor(() => {
      expect(listActiveSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText('IndexedDB 연결 실패')).not.toBeInTheDocument();
  });
});
