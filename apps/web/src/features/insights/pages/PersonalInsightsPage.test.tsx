import { screen } from '@testing-library/react';
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

  it('renders guest archive insights from the local IndexedDB archive', async () => {
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
    expect(screen.getByText('총 작품')).toBeInTheDocument();
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
    expect(screen.getByLabelText('소설 1개')).toHaveAttribute(
      'href',
      '/works?type=novel',
    );
    expect(screen.getByLabelText('완료 1개')).toHaveAttribute(
      'href',
      '/works?status=completed',
    );
    expect(screen.getByLabelText('★ 5.0 1개')).toHaveAttribute(
      'href',
      '/works?rating=5',
    );
    expect(screen.getByLabelText('다시 볼 것 1개')).toHaveAttribute(
      'href',
      '/works?tag=%EB%8B%A4%EC%8B%9C%20%EB%B3%BC%20%EA%B2%83',
    );
    expect(screen.getByLabelText('SF 1개')).toHaveAttribute(
      'href',
      '/works?genre=SF',
    );
    expect(screen.getAllByText('Dune')).toHaveLength(2);
  });
});
