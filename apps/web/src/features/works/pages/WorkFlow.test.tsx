import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../../auth/context/AuthProvider';

describe('Works routed flow', () => {
  it('creates and edits a work through the UI', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    await user.clear(screen.getByLabelText(/^제목$/));
    await user.type(screen.getByLabelText(/^제목$/), 'Dune');
    const authorInput = screen.getByLabelText(/작가·제작자/);
    await user.clear(authorInput);
    await user.type(authorInput, 'Frank Herbert');
    await user.selectOptions(screen.getByLabelText(/^상태$/), 'completed');

    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(
      await screen.findByRole('button', { name: '방금 등록한 작품 보기' }),
    );

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getAllByText(/Frank Herbert/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: '수정' }));

    const titleInput = await screen.findByLabelText(/^제목$/);

    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Messiah');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByRole('heading', { name: 'Dune Messiah' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '작품으로 돌아가기' }));

    expect(await screen.findByRole('heading', { name: '작품' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Dune Messiah' })).toBeInTheDocument();
  });
});
