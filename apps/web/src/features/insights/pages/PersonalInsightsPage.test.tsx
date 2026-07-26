import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import { worksService } from '@features/works';

function renderInsightsPage() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/insights'],
  });

  renderWithProviders(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

describe('PersonalInsightsPage', () => {
  it('shows an empty archive state', async () => {
    const router = renderInsightsPage();

    expect(
      await screen.findByRole('heading', {
        name: '아직 인사이트를 만들 기록이 없습니다.',
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/insights');
    expect(screen.getByRole('link', { name: '작품 추가' })).toHaveAttribute(
      'href',
      '/works/new',
    );
  });

  it('guides a small guest archive toward useful insights', async () => {
    const now = new Date().toISOString();

    await worksService.createWork({
      author: 'Frank Herbert',
      completedAt: now,
      description: '',
      favorite: true,
      genres: ['SF'],
      personalTags: ['다시 볼 것'],
      rating: 5,
      review: 'private note',
      shortReview: '',
      status: 'completed',
      thumbnailUrl: '',
      title: 'Dune',
      type: 'novel',
    });

    renderInsightsPage();

    expect(
      await screen.findByRole('heading', { name: '개인 인사이트' }),
    ).toBeInTheDocument();
    expect(screen.getByText('게스트 로컬 아카이브')).toBeInTheDocument();
    expect(screen.getByText('내 기기에서만 계산')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '인사이트를 만드는 중입니다' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(
      screen.getByRole('link', { name: '작품 더 추가하기' }),
    ).toHaveAttribute('href', '/works/new');
    expect(screen.getByText('Dune')).toBeInTheDocument();
  });

  it('opens historical year reviews and shows comparison trends', async () => {
    const user = userEvent.setup();
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    for (const [title, completedAt, rating] of [
      ['Current review', currentYear + '-02-10T00:00:00.000Z', 5],
      ['Previous review', previousYear + '-08-10T00:00:00.000Z', 4],
    ] as const) {
      await worksService.createWork({
        author: '',
        completedAt,
        description: '',
        favorite: false,
        genres: ['드라마'],
        personalTags: [],
        rating,
        review: '',
        shortReview: '',
        status: 'completed',
        thumbnailUrl: '',
        title,
        type: 'movie',
      });
    }

    renderInsightsPage();

    await user.click(
      await screen.findByRole('button', { name: '✦ 올해의 결산' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: currentYear + ' 연말 결산',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('월별 완료 추이')).toBeInTheDocument();
    expect(screen.getByText('전년 비교')).toBeInTheDocument();

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => undefined,
    });
    await user.click(screen.getByLabelText('결산 연도 선택'));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(
      await screen.findByRole('heading', {
        name: previousYear + ' 연말 결산',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Previous review'),
    ).toBeInTheDocument();
  });
});
