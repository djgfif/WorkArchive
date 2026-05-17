import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksRepository } from '../../works/services/works.repository';
import { worksService } from '../../works/services/works.service';

describe('ProfilePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('frames profile as a private record summary instead of a public surface', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/profile'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '게스트 기록 요약' }),
    ).toBeInTheDocument();
    expect(screen.getByText('개인 기록 이어가기')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: '작품 추가' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '인사이트 보기' })).toBeInTheDocument();
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
    expect(screen.getAllByText('보는 중').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4점').length).toBeGreaterThan(0);
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

    expect(
      await screen.findByRole('heading', {
        name: '개인 기록 요약을 불러오지 못했습니다.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품 목록 열기' })).toHaveAttribute(
      'href',
      '/works',
    );
    expect(
      screen.getByRole('link', { name: '개인 기록 오류 상태에서 작품 추가' }),
    ).toHaveAttribute('href', '/works/new');

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(await screen.findByText('첫 기록 대기')).toBeInTheDocument();
    expect(listActiveSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
