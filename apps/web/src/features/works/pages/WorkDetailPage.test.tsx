import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import {
  AuthContext,
  type AuthContextValue,
} from '@features/auth';
import * as userRecordsApi from '../services/user-records.api';
import { syncQueueRepository } from '@features/sync';
import { timelineEntriesRepository } from '../services/timeline-entries.repository';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';

const authenticatedContextValue: AuthContextValue = {
  archiveScopeKey: 'user:test-user',
  isLoading: false,
  mode: 'authenticated',
  user: {
    avatarUrl: '',
    email: 'user@example.com',
    id: 'test-user',
    nickname: 'Tester',
    role: 'user',
  },
  signOut: vi.fn(async () => undefined),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkDetailPage', () => {
  it('shows graph chips, production info, and same-series local works', async () => {
    const work = await worksService.createWork({
      type: 'anime',
      title: 'Fate/stay night',
      author: 'TYPE-MOON',
      genres: ['Fantasy'],
      personalTags: [
        'series:Fate',
        'universe:TYPE-MOON',
        'creator:Nasu Kinoko',
        'studio:ufotable',
      ],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 4.5,
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
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Fate/stay night' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '내 기록' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /감상/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '진행도' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '타임라인' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '연결된 작품' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '메타데이터' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '타임라인' }));
    expect(screen.getByText(/최근 기록:|아직 날짜 기록이 없습니다/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '메타데이터' }));
    expect((await screen.findAllByText('Fate')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('TYPE-MOON')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('ufotable')).length).toBeGreaterThan(0);
    expect(screen.getByText('제작 정보')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '연결된 작품' }));
    expect(screen.getByText('같은 시리즈 / 세계관')).toBeInTheDocument();
    expect(screen.getByText('같은 제작진')).toBeInTheDocument();
    expect((await screen.findAllByText('Fate/Zero')).length).toBeGreaterThan(0);
    expect(screen.getByText('스튜디오: ufotable')).toBeInTheDocument();
  });

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
      favorite: true,
    });
    await worksService.updateProgress(work.id, {
      lastConsumedLabel: '2권까지',
      progressCurrent: 2,
      progressTotal: 3,
      progressUnit: 'volume',
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getAllByText('2권까지').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Dune 상세 진행도 67%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /감상/ }));
    expect(
      screen.getByText('세계관의 밀도와 긴장감이 오래 남는다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps detail read-first and links naturally into review editing', async () => {
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
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await screen.findByRole('heading', { name: 'Frieren' });
    expect(
      screen.getAllByRole('link', { name: '리뷰 쓰기' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '전체 정보 수정' })).toBeInTheDocument();
    expect(screen.getByLabelText('Frieren 빠른 상태')).toBeInTheDocument();
    expect(screen.getByLabelText('Frieren 빠른 별점')).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: '리뷰 쓰기' })[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Frieren 감상 수정' }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('리뷰 집중 모드')).length).toBeGreaterThan(
      0,
    );
    const shortReviewInput = await screen.findByLabelText('한 줄 감상');
    await waitFor(() => expect(shortReviewInput).toHaveFocus());
    expect(shortReviewInput).toHaveAccessibleDescription(
      /상세 화면에서 이어 온 리뷰 집중 수정 입력입니다/,
    );
    expect(
      await screen.findByRole('button', { name: '저장' }),
    ).toBeInTheDocument();
  });

  it('keeps derived timeline dates and supports manual timeline entry add/delete', async () => {
    const work = await worksService.createWork({
      type: 'novel',
      title: 'Timeline Detail Work',
      author: 'Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
      startedAt: '2026-02-01T00:00:00.000Z',
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

    expect(
      await screen.findByRole('heading', { name: 'Timeline Detail Work' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '타임라인' }));
    expect(screen.getAllByText('감상 시작').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '고급 기록 추가' }));

    await user.selectOptions(
      screen.getByLabelText('Timeline Detail Work 기록 내역 유형'),
      'rewatch',
    );
    await user.clear(
      screen.getByLabelText('Timeline Detail Work 기록 내역 날짜'),
    );
    await user.type(
      screen.getByLabelText('Timeline Detail Work 기록 내역 날짜'),
      '2026-02-04',
    );
    await user.type(
      screen.getByLabelText('Timeline Detail Work 기록 내역 메모'),
      '두 번째 감상 시작',
    );
    await user.click(
      screen.getByRole('button', { name: '기록 추가' }),
    );

    expect(await screen.findByText('두 번째 감상 시작')).toBeInTheDocument();
    await expect
      .poll(async () => timelineEntriesRepository.listByWorkId(work.id))
      .toEqual([
        expect.objectContaining({
          note: '두 번째 감상 시작',
          syncStatus: 'pending',
          type: 'rewatch',
        }),
      ]);
    await expect
      .poll(async () => syncQueueRepository.listAll())
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityType: 'timeline_entry',
            operation: 'create',
          }),
        ]),
      );

    const deleteButtons = screen.getAllByRole('button', { name: '삭제' });
    await user.click(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.queryByText('두 번째 감상 시작')).not.toBeInTheDocument();
    });
    await expect
      .poll(async () => timelineEntriesRepository.listByWorkId(work.id))
      .toEqual([]);
    await expect
      .poll(async () =>
        (await syncQueueRepository.listAll()).filter(
          (item) => item.entityType === 'timeline_entry',
        ),
      )
      .toEqual([]);
  });

  it('keeps dense timelines summarized until the user expands them', async () => {
    const work = await worksService.createWork({
      type: 'novel',
      title: 'Dense Timeline Work',
      author: 'Author',
      genres: [],
      description: '',
      thumbnailUrl: '',
      status: 'dropped',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
      completedAt: '2026-02-03T00:00:00.000Z',
      droppedAt: '2026-02-04T00:00:00.000Z',
      lastConsumedAt: '2026-02-02T00:00:00.000Z',
      startedAt: '2026-02-01T00:00:00.000Z',
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

    expect(
      await screen.findByRole('heading', { name: 'Dense Timeline Work' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '타임라인' }));
    const advancedRecordToggle = screen.getByRole('button', {
      expanded: false,
      name: '고급 기록 추가',
    });
    expect(advancedRecordToggle).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Dense Timeline Work 기록 내역 유형'),
    ).not.toBeVisible();

    await user.click(advancedRecordToggle);

    expect(
      screen.getByLabelText('Dense Timeline Work 기록 내역 유형'),
    ).toBeInTheDocument();
  });

  it('saves status, rating, favorite, and short review from the detail quick record section', async () => {
    const work = await worksService.createWork({
      type: 'novel',
      title: 'Quick Detail Work',
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
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await screen.findByRole('heading', { name: 'Quick Detail Work' });
    await user.selectOptions(
      screen.getByLabelText('Quick Detail Work 빠른 상태'),
      'completed',
    );
    await user.selectOptions(
      screen.getByLabelText('Quick Detail Work 빠른 별점'),
      '4.5',
    );
    await user.type(
      screen.getByLabelText('Quick Detail Work 빠른 한줄평'),
      '상세에서 바로 남긴 기록',
    );
    await user.click(screen.getByRole('button', { name: '즐겨찾기' }));
    await user.click(screen.getByRole('button', { name: '빠른 기록 저장' }));

    expect(
      await screen.findByText('빠른 기록을 저장했습니다.'),
    ).toBeInTheDocument();
    await expect
      .poll(async () => worksService.getWorkById(work.id))
      .toEqual(
        expect.objectContaining({
          favorite: true,
          rating: 4.5,
          shortReview: '상세에서 바로 남긴 기록',
          status: 'completed',
        }),
      );
  });

  it('shows volume-level records for novels when catalog releases exist', async () => {
    vi.spyOn(userRecordsApi, 'fetchUserRecordReleases').mockResolvedValue({
      policy: {
        defaultProgressUnit: 'volume',
        mediumType: 'novel',
        progressOnly: false,
        recordingUnit: 'catalog_title',
        releaseRecordsSupported: true,
        webPartSplitEnabled: true,
      },
      releases: [
        {
          displayLabel: 'Vol. 1',
          id: 'release-1',
          isbn: '9781234567890',
          releaseDate: '2026-04-18T00:00:00.000Z',
          releaseType: 'volume',
          sequence: 1,
          summary: '',
          thumbnailUrl: '',
          title: 'Spice and Wolf Vol. 1',
          userReleaseRecord: null,
        },
      ],
    });
    vi.spyOn(userRecordsApi, 'fetchRelatedCatalogTitles').mockResolvedValue({
      catalogTitleId: 'catalog-title-1',
      currentTitle: {
        displayTitle: 'Spice and Wolf',
        franchise: null,
        id: 'catalog-title-1',
        mediumType: 'novel',
        releaseYear: 2006,
        subType: null,
        thumbnailUrl: '',
      },
      relations: [],
      sameFranchiseTitles: [],
    });
    const work = await worksService.createWork({
      type: 'novel',
      title: 'Spice and Wolf',
      author: 'Isuna Hasekura',
      genres: ['Fantasy'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    await worksRepository.update({
      ...work,
      catalogTitleId: 'catalog-title-1',
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthContext.Provider value={authenticatedContextValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    );

    await screen.findByRole('heading', { name: 'Spice and Wolf' });
    await userEvent.click(screen.getByRole('tab', { name: '진행도' }));
    expect(await screen.findByText('Vol. 1')).toBeInTheDocument();
  });

  it('renders related franchise titles below the main record', async () => {
    vi.spyOn(userRecordsApi, 'fetchUserRecordReleases').mockResolvedValue({
      policy: {
        defaultProgressUnit: null,
        mediumType: 'anime',
        progressOnly: true,
        recordingUnit: 'catalog_title',
        releaseRecordsSupported: false,
        webPartSplitEnabled: true,
      },
      releases: [],
    });
    vi.spyOn(userRecordsApi, 'fetchRelatedCatalogTitles').mockResolvedValue({
      catalogTitleId: 'catalog-title-2',
      currentTitle: {
        displayTitle: 'Steins;Gate',
        franchise: {
          canonicalName: 'Science Adventure',
          id: 'franchise-1',
          name: 'Science Adventure',
        },
        id: 'catalog-title-2',
        mediumType: 'anime',
        releaseYear: 2011,
        subType: 'tv',
        thumbnailUrl: '',
      },
      relations: [
        {
          relationDirection: 'outgoing',
          relationType: 'sequel',
          targetTitle: {
            franchise: {
              id: 'franchise-1',
              name: 'Science Adventure',
            },
            id: 'catalog-title-3',
            mediumType: 'anime',
            releaseYear: 2018,
            relationDirection: 'outgoing',
            relationType: 'sequel',
            subType: 'tv',
            thumbnailUrl: '',
            title: 'Steins;Gate 0',
          },
        },
      ],
      sameFranchiseTitles: [
        {
          franchise: {
            id: 'franchise-1',
            name: 'Science Adventure',
          },
          id: 'catalog-title-3',
          mediumType: 'anime',
          releaseYear: 2018,
          relationDirection: 'outgoing',
          relationType: 'sequel',
          subType: 'tv',
          thumbnailUrl: '',
          title: 'Steins;Gate 0',
        },
        {
          franchise: {
            id: 'franchise-1',
            name: 'Science Adventure',
          },
          id: 'catalog-title-4',
          mediumType: 'movie',
          releaseYear: 2013,
          relationDirection: null,
          relationType: null,
          subType: null,
          thumbnailUrl: '',
          title: 'Steins;Gate Movie',
        },
      ],
    });
    const work = await worksService.createWork({
      type: 'anime',
      title: 'Steins;Gate',
      author: 'White Fox',
      genres: ['Sci-Fi'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });
    await worksRepository.update({
      ...work,
      catalogTitleId: 'catalog-title-2',
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthContext.Provider value={authenticatedContextValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    );

    await screen.findByRole('heading', { name: 'Steins;Gate' });
    await userEvent.click(screen.getByRole('tab', { name: '연결된 작품' }));
    expect(screen.getByText('카탈로그 연결')).toBeInTheDocument();
    expect(await screen.findByText('Steins;Gate 0')).toBeInTheDocument();
    expect(screen.getByText('Steins;Gate Movie')).toBeInTheDocument();
  });

  it('shows progress-only controls for anime without episode-level rating UI', async () => {
    const work = await worksService.createWork({
      type: 'anime',
      title: 'KonoSuba TV Anime',
      author: 'Studio Deen',
      genres: ['Comedy'],
      description: '',
      thumbnailUrl: '',
      status: 'in_progress',
      rating: null,
      shortReview: '',
      review: '',
      favorite: false,
    });

    const router = createMemoryRouter(appRoutes, {
      initialEntries: [`/works/${work.id}`],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'KonoSuba TV Anime' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '진행도' }));
    expect(
      screen.getByRole('heading', { name: '애니 진행 기록' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('본 회차')).toBeInTheDocument();
    expect(screen.queryByText('권별 기록')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('권별 별점')).not.toBeInTheDocument();
  });
});
