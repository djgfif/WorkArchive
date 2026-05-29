import { screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import { worksService } from '@features/works';

describe('HomePage', () => {
  it('shows onboarding paths when the archive is empty', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('첫 작품을 놓는 방법')).toBeInTheDocument();
    expect(screen.getAllByText('첫 작품 추가').length).toBeGreaterThan(0);
    expect(screen.getAllByText('검색으로 추가').length).toBeGreaterThan(0);
    expect(screen.getAllByText('백업 가져오기').length).toBeGreaterThan(0);
    expect(screen.getAllByText('작품').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0개').length).toBeGreaterThan(0);
  });

  it('keeps the home focused on the personal shelf, continue flow, and search', async () => {
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
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
      lastConsumedAt: new Date().toISOString(),
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('이어볼 작품')).toBeInTheDocument();
    expect(screen.getAllByText('작품').length).toBeGreaterThan(0);
    expect(screen.getAllByText('진행 중').length).toBeGreaterThan(0);
    expect(screen.getByText('평균 별점')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '평가 안 한 작품 1개' }),
    ).toBeInTheDocument();
    expect(screen.getByText('최근 감상한 작품')).toBeInTheDocument();
    expect(screen.getByText('최근 정리한 감상')).toBeInTheDocument();
    expect(screen.queryByText('시리즈 컬렉션')).not.toBeInTheDocument();
    expect(screen.queryByText('제작진으로 보기')).not.toBeInTheDocument();

    expect(
      screen
        .getByText('이어볼 작품')
        .compareDocumentPosition(screen.getByText('최근 정리한 감상')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows highly rated works and compact archive insights', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'The Archive Star',
      author: 'A Writer',
      genres: ['Mystery'],
      personalTags: ['series:Archive Saga', 'creator:A Writer'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      favorite: true,
    });

    await worksService.createWork({
      type: 'novel',
      title: 'The Archive Moon',
      author: 'A Writer',
      genres: ['Mystery'],
      personalTags: ['series:Archive Saga', 'creator:A Writer'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 4.5,
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

    expect(await screen.findByText('높게 평가한 작품')).toBeInTheDocument();
    expect(screen.getByText('작은 취향 단서')).toBeInTheDocument();
    expect(screen.getAllByText('#Mystery').length).toBeGreaterThan(0);
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
