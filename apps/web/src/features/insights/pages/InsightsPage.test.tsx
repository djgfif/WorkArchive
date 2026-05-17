import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksRepository } from '../../works/services/works.repository';
import { worksService } from '../../works/services/works.service';

function getLinkSearchParams(href: string) {
  return new URL(href, 'http://localhost').searchParams;
}

describe('InsightsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers recovery actions when insight aggregation cannot load', async () => {
    const user = userEvent.setup();
    const listAllSpy = vi
      .spyOn(worksRepository, 'listAll')
      .mockRejectedValueOnce(new Error('IndexedDB 연결 실패'));
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/insights'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: '인사이트를 불러오지 못했습니다',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품 목록 열기' })).toHaveAttribute(
      'href',
      '/works',
    );
    expect(
      screen.getByRole('link', { name: '인사이트 오류 상태에서 작품 추가' }),
    ).toHaveAttribute('href', '/works/new');

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(
      await screen.findByRole('heading', { name: '아직 집계할 기록이 없습니다' }),
    ).toBeInTheDocument();
    expect(listAllSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('links insight distribution rows back to filtered works views', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['SF'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      tier: null,
      favorite: true,
      personalTags: ['다시 볼 것'],
    });
    await worksService.createWork({
      type: 'anime',
      title: 'Frieren',
      author: 'Madhouse',
      genres: ['Fantasy'],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: 4.5,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
      personalTags: ['여운'],
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/insights'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '내 취향 대시보드' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '매체별 기록' }),
    ).toBeInTheDocument();

    const viewLinks = screen.getAllByRole('link', { name: '보기' });
    const searchParamsList = viewLinks.map((link) =>
      getLinkSearchParams(link.getAttribute('href') ?? ''),
    );

    expect(
      searchParamsList.some((params) => params.get('type') === 'novel'),
    ).toBe(true);
    expect(searchParamsList.some((params) => params.get('q') === 'SF')).toBe(
      true,
    );
    expect(
      searchParamsList.some((params) => params.get('tag') === '다시 볼 것'),
    ).toBe(true);
    expect(
      searchParamsList.some((params) => params.get('status') === 'completed'),
    ).toBe(true);
    expect(
      searchParamsList.some(
        (params) =>
          params.get('rating') === '5' && params.get('sort') === 'rating',
      ),
    ).toBe(true);
  });

  it('links stale works directly back to their detail pages as continue actions', async () => {
    const staleWork = await worksService.createWork({
      type: 'anime',
      title: 'Long Running Anime',
      author: 'Studio',
      genres: ['Fantasy'],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
      startedAt: '2000-01-01T00:00:00.000Z',
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/insights'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '오래 방치한 작품' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Long Running Anime')).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Long Running Anime 이어 기록하기',
      }),
    ).toHaveAttribute('href', `/works/${staleWork.id}`);
  });
});
