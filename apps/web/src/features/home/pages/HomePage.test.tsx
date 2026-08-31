import { screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import { timelineEntriesRepository, worksService } from '@features/works';

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

    expect(
      await screen.findByText('아직 기록한 작품이 없습니다'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('작품 하나를 추가하면 오늘의 기록이 시작됩니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '직접 추가' })).toHaveAttribute(
      'href',
      '/works/new?mode=manual',
    );
    expect(
      screen.getByRole('link', { name: 'JSON 백업 가져오기' }),
    ).toHaveAttribute('href', '/account/settings#data-backup');
    expect(screen.getAllByText('0개').length).toBeGreaterThan(0);

    expect(
      screen
        .getByRole('heading', { level: 1, name: '오늘의 기록' })
        .compareDocumentPosition(
          screen.getByRole('textbox', { name: '빠른 작품 기록' }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

    const continueWork = await worksService.createWork({
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
    await worksService.updateProgress(continueWork.id, {
      lastConsumedLabel: '2회까지',
      progressCurrent: 2,
      progressTotal: 12,
      progressUnit: 'episode',
    });

    for (const title of ['Fate filler one', 'Fate filler two']) {
      await worksService.createWork({
        type: 'anime',
        title,
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

    const user = userEvent.setup();
    expect(await screen.findByText('이어서 기록')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '기록 추가' })).toHaveLength(
      1,
    );
    expect(
      screen.queryByRole('link', { name: '+ 추가' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('최근 감상한 작품')).toBeInTheDocument();
    expect(screen.getByText('최근 정리한 감상')).toBeInTheDocument();
    expect(screen.queryByText('시리즈 컬렉션')).not.toBeInTheDocument();
    expect(screen.queryByText('제작진으로 보기')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Fate/Zero 3회까지 기록' }),
    );

    expect(
      await screen.findByText('Fate/Zero 3회까지 기록했습니다.'),
    ).toBeInTheDocument();
    await expect(worksService.getWorkById(continueWork.id)).resolves.toEqual(
      expect.objectContaining({
        lastConsumedLabel: '3회까지',
        progressCurrent: 3,
        progressTotal: 12,
        progressUnit: 'episode',
      }),
    );
    await expect(
      timelineEntriesRepository.listByWorkId(continueWork.id),
    ).resolves.toEqual([
      expect.objectContaining({ source: 'automatic', type: 'progress' }),
      expect.objectContaining({ source: 'automatic', type: 'progress' }),
    ]);

    expect(
      screen
        .getByText('이어서 기록')
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

    for (const title of ['Archive filler one', 'Archive filler two']) {
      await worksService.createWork({
        type: 'novel',
        title,
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
