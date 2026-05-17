import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { worksService } from '../services/works.service';

describe('WorksListPage', () => {
  it('opens the modal-first add flow from the library page', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await screen.findByText(
      '아직 등록된 작품이 없습니다. 검색과 추가 흐름에서 바로 시작할 수 있습니다.',
    );
    await user.click(screen.getAllByRole('button', { name: '작품 추가' })[0]!);

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('직접 입력')).toBeChecked();

    await user.type(
      within(dialog).getByLabelText(/^제목$/),
      'Modal First Work',
    );
    await user.selectOptions(within(dialog).getByLabelText(/^유형$/), 'movie');
    await user.click(
      within(dialog).getByRole('button', { name: '내 아카이브에 저장' }),
    );

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
      { timeout: 5_000 },
    );
    expect(await screen.findByText('Modal First Work')).toBeInTheDocument();
  });

  it('shows filtered and total active counts accurately', async () => {
    const dune = await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '모래 행성의 정치와 신화가 좋다.',
      review: '',
      tier: 'S',
      favorite: true,
    });

    await worksService.updateProgress(dune.id, {
      progressCurrent: 4,
      progressTotal: 6,
      progressUnit: 'volume',
      lastConsumedLabel: '4권까지',
    });

    await worksService.createWork({
      type: 'movie',
      title: 'Your Name',
      author: 'Makoto Shinkai',
      genres: ['Drama'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: 4,
      shortReview: '',
      review: '',
      tier: 'A',
      favorite: false,
    });

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText(/작품 2개가 등록되어 있습니다\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '리스트' })).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('별점 5.0')).toBeInTheDocument();
    expect(
      screen.queryByText('모래 행성의 정치와 신화가 좋다.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('4권까지')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dune 진행도 67%')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '리스트' }));
    expect(
      await screen.findByText('모래 행성의 정치와 신화가 좋다.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Dune 진행도 67%')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^유형$/), 'novel');

    expect(
      await screen.findByText(/전체 2개 중 1개를 보고 있습니다\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Your Name' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the selected works view in the URL', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'URL View Work',
      author: 'Author',
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

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works?view=list'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByLabelText('URL View Work 상태'),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=list');

    await user.click(screen.getByRole('button', { name: '포스터' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(
      screen.queryByLabelText('URL View Work 상태'),
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '리스트' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=list');
    });
    expect(
      await screen.findByLabelText('URL View Work 상태'),
    ).toBeInTheDocument();
  });

  it('keeps quick edit for status and rating working in list view', async () => {
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
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '리스트' }));
    await screen.findByText('Frieren');

    await user.selectOptions(
      screen.getByLabelText('Frieren 상태'),
      'completed',
    );
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Frieren 상태') as HTMLSelectElement).value,
      ).toBe('completed');
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Frieren 별점')).toBeEnabled();
    });

    await user.selectOptions(screen.getByLabelText('Frieren 별점'), '4.5');
    await waitFor(() => {
      expect(
        (screen.getByLabelText('Frieren 별점') as HTMLSelectElement).value,
      ).toBe('4.5');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Frieren 즐겨찾기')).toBeEnabled();
    });
    await user.click(screen.getByLabelText('Frieren 즐겨찾기'));
    await waitFor(async () => {
      expect(await worksService.getWorkById(work.id)).toEqual(
        expect.objectContaining({
          favorite: true,
          syncStatus: 'local-only',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Frieren 현재 권')).toBeEnabled();
    });
    await user.type(screen.getByLabelText('Frieren 현재 권'), '3');
    await user.type(screen.getByLabelText('Frieren 전체 권'), '5');
    await user.type(screen.getByLabelText('Frieren 마지막 위치'), '3권');
    await user.click(screen.getByLabelText('Frieren 진행도 저장'));

    await waitFor(async () => {
      expect(await worksService.getWorkById(work.id)).toEqual(
        expect.objectContaining({
          lastConsumedLabel: '3권',
          progressCurrent: 3,
          progressTotal: 5,
          progressUnit: 'volume',
        }),
      );
    });
  });

  it('shows deleted works in trash scope and restores them', async () => {
    const deleted = await worksService.createWork({
      type: 'novel',
      title: 'Spice & Wolf',
      author: 'Isuna Hasekura',
      genres: ['Fantasy'],
      description: '',
      thumbnailUrl: '',
      status: 'paused',
      rating: 4,
      shortReview: '다시 읽을 예정',
      review: '',
      tier: null,
      favorite: false,
    });

    await worksService.deleteWork(deleted.id);

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works?scope=trash'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText(/숨겨둔 작품 1개를 보고 있습니다\./),
    ).toBeInTheDocument();
    expect(await screen.findByText('Spice & Wolf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '복원' }));

    await waitFor(() => {
      expect(screen.queryByText('Spice & Wolf')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '작품 목록' }));
    await waitFor(() => {
      expect(screen.getAllByText('Spice & Wolf').length).toBeGreaterThan(0);
    });
  });
});
