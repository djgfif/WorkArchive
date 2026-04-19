import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksService } from '../services/works.service';

describe('WorkDetailPage', () => {
  it('treats review sections as collapsible first-class content', async () => {
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

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('내 평점')).toBeInTheDocument();
    expect(screen.getAllByText('4.5점').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: '상세 감상 펼치기' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '상세 감상 펼치기' }));

    expect(
      await screen.findByText(
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '상세 감상 접기' }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
        ),
      ).not.toBeInTheDocument();
    });
  });
});
