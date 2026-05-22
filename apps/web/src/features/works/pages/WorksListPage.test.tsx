import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import {
  getActiveFilterControls,
  getAdvancedFiltersButton,
  openAdvancedFilters,
  selectWorksView,
} from '../../../test/ui-helpers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { appMetaRepository } from '../../sync/services/app-meta.repository';
import { LAST_JSON_EXPORT_AT_META_KEY } from '../../archive/utils/json-backup-reminder';
import { worksService } from '../services/works.service';

describe('WorksListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers recovery actions when the works list cannot load', async () => {
    const user = userEvent.setup();
    const listWorksSpy = vi
      .spyOn(worksService, 'listWorks')
      .mockRejectedValueOnce(new Error('IndexedDB 연결 실패'));
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: '작품 목록을 불러오지 못했습니다.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '목록 오류 상태에서 작품 추가' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    await waitFor(() => {
      expect(listWorksSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText('IndexedDB 연결 실패')).not.toBeInTheDocument();
    expect(listWorksSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

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

    await user.click(
      (await screen.findAllByRole('button', { name: '작품 추가' }))[0]!,
    );

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

  it('shows empty-state actions for direct add, search add, and JSON backup import', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: '아직 기록한 작품이 없습니다.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '직접 추가' }),
    ).toHaveAttribute('href', '/works/new');
    expect(
      screen.getByRole('button', { name: '검색으로 추가' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'JSON 백업 가져오기' }),
    ).toHaveAttribute('href', '/account/settings');
  });

  it('shows the shared JSON backup reminder after 20 active works without a backup', async () => {
    for (let index = 0; index < 20; index += 1) {
      await worksService.createWork({
        type: 'novel',
        title: `Backup Reminder Work ${index + 1}`,
        author: '',
        genres: [],
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
      initialEntries: ['/works'],
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

  it('shows recently viewed works after opening a detail page', async () => {
    const viewedWork = await worksService.createWork({
      type: 'movie',
      title: 'Recently Viewed Movie',
      author: 'Director',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${viewedWork.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('Recently Viewed Movie')).toBeInTheDocument();

    await router.navigate('/works');

    expect(await screen.findByText('최근 본 작품')).toBeInTheDocument();
    expect(screen.getByText('방금 열어본 기록')).toBeInTheDocument();
    expect(screen.getAllByText('Recently Viewed Movie').length).toBeGreaterThan(0);
  });

  it('shows recently modified works as shortcuts', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Older Work',
      author: 'Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    const modifiedWork = await worksService.createWork({
      type: 'anime',
      title: 'Freshly Edited Work',
      author: 'Studio',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    await worksService.updateWork(modifiedWork.id, {
      type: modifiedWork.type,
      title: modifiedWork.title,
      author: modifiedWork.author,
      genres: modifiedWork.genres,
      description: 'updated',
      thumbnailUrl: modifiedWork.thumbnailUrl,
      status: modifiedWork.status,
      rating: modifiedWork.rating,
      shortReview: modifiedWork.shortReview,
      review: modifiedWork.review,
      favorite: modifiedWork.favorite,
      personalTags: modifiedWork.personalTags,
      lastConsumedAt: modifiedWork.lastConsumedAt ?? null,
      startedAt: modifiedWork.startedAt ?? null,
      completedAt: modifiedWork.completedAt ?? null,
      droppedAt: modifiedWork.droppedAt ?? null,
    });
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('최근 수정한 작품')).toBeInTheDocument();
    expect(screen.getByText('최근 손본 기록')).toBeInTheDocument();
    expect(screen.getAllByText('Freshly Edited Work').length).toBeGreaterThan(0);
  });

  it('shows the last JSON backup time and applies bulk management actions', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await appMetaRepository.setValue(
      LAST_JSON_EXPORT_AT_META_KEY,
      '2026-05-20T03:00:00.000Z',
    );
    const firstWork = await worksService.createWork({
      type: 'novel',
      title: 'Bulk First',
      author: 'Archive Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    const secondWork = await worksService.createWork({
      type: 'movie',
      title: 'Bulk Second',
      author: 'Archive Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
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

    expect(await screen.findByText(/마지막 JSON 백업:/)).toBeInTheDocument();
    expect(await screen.findByText(/2026/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '일괄 선택' }));
    await user.click(screen.getByLabelText('Bulk First 선택'));
    await user.click(screen.getByLabelText('Bulk Second 선택'));

    const bulkTagInput = screen
      .getAllByLabelText('일괄 태그 추가')
      .find((element) => element instanceof HTMLInputElement);
    if (!bulkTagInput) {
      throw new Error('Bulk tag input was not found.');
    }
    await user.type(bulkTagInput, '관리대상{enter}');
    await user.click(screen.getByRole('button', { name: '선택 작품 태그 추가' }));

    await waitFor(async () => {
      await expect(worksService.getWorkById(firstWork.id)).resolves.toEqual(
        expect.objectContaining({
          personalTags: expect.arrayContaining(['관리대상']),
        }),
      );
      await expect(worksService.getWorkById(secondWork.id)).resolves.toEqual(
        expect.objectContaining({
          personalTags: expect.arrayContaining(['관리대상']),
        }),
      );
    });

    const bulkStatusSelect = screen.getByLabelText('일괄 상태 변경');
    await waitFor(() => expect(bulkStatusSelect).toBeEnabled());
    fireEvent.change(bulkStatusSelect, { target: { value: 'completed' } });
    const bulkStatusButton = screen.getByRole('button', {
      name: '선택 작품 상태 변경',
    });
    await waitFor(() => expect(bulkStatusButton).toBeEnabled());
    await user.click(bulkStatusButton);

    await waitFor(async () => {
      await expect(worksService.getWorkById(firstWork.id)).resolves.toEqual(
        expect.objectContaining({ status: 'completed' }),
      );
      await expect(worksService.getWorkById(secondWork.id)).resolves.toEqual(
        expect.objectContaining({ status: 'completed' }),
      );
    });

    const bulkDeleteButton = screen.getByRole('button', {
      name: '선택 작품 휴지통 이동',
    });
    await waitFor(() => expect(bulkDeleteButton).toBeEnabled());
    await user.click(bulkDeleteButton);

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(async () => {
      await expect(worksService.getWorkById(firstWork.id)).resolves.toBeNull();
      await expect(worksService.getWorkById(secondWork.id)).resolves.toBeNull();
    });
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

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Name' })).toBeInTheDocument();
    expect(
      screen.queryByText('모래 행성의 정치와 신화가 좋다.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('4권까지')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dune 진행도 67%')).not.toBeInTheDocument();

    await selectWorksView(user, 'list');
    expect(screen.getByLabelText('Dune 진행도 67%')).toBeInTheDocument();

    await openAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: '소설' }));

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('type')).toBe(
        'novel',
      );
    });
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Your Name' }),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps active filter chips visible while advanced filters are collapsed and removes them individually', async () => {
    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      favorite: false,
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
      favorite: false,
    });

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [
        '/works?q=Dune&status=completed&type=novel&rating=5&sort=rating',
      ],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByLabelText('작품 검색 (단축키: /)')).toHaveValue('Dune');
    expect(getAdvancedFiltersButton()).toHaveAttribute('aria-expanded', 'false');
    expect(getActiveFilterControls()).toHaveLength(5);
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your Name' }),
    ).not.toBeInTheDocument();

    await user.click(getActiveFilterControls()[0]!);

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).has('q')).toBe(
        false,
      );
    });
    expect(screen.getByLabelText('작품 검색 (단축키: /)')).toHaveValue('');

    await user.click(getActiveFilterControls()[0]!);
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).has('status'),
      ).toBe(false);
    });

    await user.click(getActiveFilterControls()[0]!);
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).has('rating'),
      ).toBe(false);
    });

    await user.click(getActiveFilterControls()[0]!);
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).has('type'),
      ).toBe(false);
    });

    await user.click(getActiveFilterControls()[0]!);
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Name' })).toBeInTheDocument();
  });

  it('shows graph filters before status and syncs them with the URL', async () => {
    await worksService.createWork({
      type: 'anime',
      title: 'Fate/stay night',
      author: 'TYPE-MOON',
      genres: ['Fantasy'],
      personalTags: ['series:Fate', 'universe:TYPE-MOON', 'studio:ufotable'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 5,
      shortReview: '',
      review: '',
      favorite: false,
    });

    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      personalTags: ['series:Dune', 'creator:Frank Herbert'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
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
      await screen.findByRole('heading', { name: 'Fate/stay night' }),
    ).toBeInTheDocument();

    expect(screen.getByText('매체')).toBeInTheDocument();
    expect(screen.getByText('작가 / 제작진')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: '고급 필터' }));

    for (const label of [
      '시리즈 / 세계관',
      '작가 / 제작진',
      '회사 / 플랫폼',
      '장르',
      '상태',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: '애니' }));
    await user.click(screen.getByRole('button', { name: 'Fate' }));
    await user.click(screen.getByRole('button', { name: 'ufotable' }));
    await user.click(screen.getByRole('button', { name: 'Fantasy' }));
    await user.click(screen.getByRole('button', { name: /완료/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);

      expect(params.get('type')).toBe('anime');
      expect(params.get('series')).toBe('Fate');
      expect(params.get('organizationContributor')).toBe('ufotable');
      expect(params.get('genre')).toBe('Fantasy');
      expect(params.get('status')).toBe('completed');
    });
    expect(screen.getByRole('heading', { name: 'Fate/stay night' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Dune' }),
    ).not.toBeInTheDocument();
  });

  it('renders large libraries progressively and lets users load more items', async () => {
    for (let index = 1; index <= 75; index += 1) {
      await worksService.createWork({
        type: 'novel',
        title: `Work ${String(index).padStart(3, '0')}`,
        author: 'Archive Author',
        genres: [],
        description: '',
        thumbnailUrl: '',
        status: 'planned',
        rating: null,
        shortReview: '',
        review: '',
        favorite: false,
      });
    }

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works?sort=title'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Work 001' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Work \d{3}$/ })).toHaveLength(60);
    expect(
      screen.queryByRole('heading', { name: 'Work 075' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '작품 15개 더 보기' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Work 075' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Work \d{3}$/ })).toHaveLength(75);
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

    await selectWorksView(user, 'grid');

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(
      screen.queryByLabelText('URL View Work 상태'),
    ).not.toBeInTheDocument();

    await selectWorksView(user, 'list');

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

    await selectWorksView(user, 'list');
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

  it('offers undo after soft-deleting a work from the list', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleted = await worksService.createWork({
      type: 'novel',
      title: 'Undo Target',
      author: 'Archive Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
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

    expect(await screen.findByText('Undo Target')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Undo Target 삭제'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(
      await screen.findByText('휴지통으로 이동했습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Undo Target 기록을 되돌릴 수 있습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    expect(await screen.findByText('되돌렸습니다.')).toBeInTheDocument();
    await waitFor(async () => {
      expect(await worksService.getWorkById(deleted.id)).toEqual(
        expect.objectContaining({
          deletedAt: null,
          title: 'Undo Target',
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
      status: 'dropped',
      rating: 4,
      shortReview: '다시 읽을 예정',
      review: '',
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
