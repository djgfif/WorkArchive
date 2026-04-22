import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksService } from '../services/works.service';

describe('WorkDetailPage', () => {
  it('renders short review and full review before metadata cards', async () => {
    const work = await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '사막 행성과 권력 구도를 중심으로 전개되는 작품입니다.',
      thumbnailUrl: '',
      status: 'completed',
      rating: 4.5,
      shortReview: '세계관의 밀도와 긴장감이 오래 남는다.',
      review:
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      tier: 'S',
      favorite: true,
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('내 평점')).toBeInTheDocument();
    expect(screen.getByText('세계관의 밀도와 긴장감이 오래 남는다.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('한줄평')).not.toHaveTextContent('있음');
    expect(screen.queryByText('상세 감상')).not.toHaveTextContent('있음');
  });

  it('keeps quick edits on detail and links naturally into review editing', async () => {
    const work = await worksService.createWork({
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
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await screen.findByRole('heading', { name: 'Frieren' });

    await user.selectOptions(screen.getByLabelText('Frieren 상세 상태'), 'completed');
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Frieren 상세 상태') as HTMLSelectElement).value,
      ).toBe('completed');
    });

    await user.click(screen.getByRole('link', { name: '리뷰 쓰기' }));

    expect(await screen.findByRole('heading', { name: 'Frieren 감상 수정' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
