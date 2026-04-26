import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { AuthContext, type AuthContextValue } from '../../auth/context/AuthContext';
import * as userRecordsApi from '../services/user-records.api';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';

const authenticatedContextValue: AuthContextValue = {
  archiveScopeKey: 'user:test-user',
  isLoading: false,
  mode: 'authenticated',
  user: {
    email: 'user@example.com',
    id: 'test-user',
    nickname: 'Tester',
    role: 'user',
  },
  signIn: vi.fn(async () => '/'),
  signOut: vi.fn(async () => undefined),
  signUp: vi.fn(async () => '/'),
};

afterEach(() => {
  vi.restoreAllMocks();
});

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

    expect(await screen.findByText('별점')).toBeInTheDocument();
    expect(screen.getAllByText('2권까지').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Dune 상세 진행도 67%')).toBeInTheDocument();
    expect(screen.getByText('세계관의 밀도와 긴장감이 오래 남는다.')).toBeInTheDocument();
    expect(
      screen.getByText(
        '긴 감상입니다. 인물의 선택과 정치 구조가 얽히는 방식이 인상적이었고, 후반부의 긴장감도 좋았습니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('한줄평')).not.toHaveTextContent('있음');
    expect(screen.queryByText('상세 감상')).not.toHaveTextContent('있음');
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
    expect(screen.getAllByRole('link', { name: '리뷰 쓰기' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '기록 수정' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Frieren 상세 상태')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: '리뷰 쓰기' })[0]!);

    expect(await screen.findByRole('heading', { name: 'Frieren 감상 수정' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '저장' })).toBeInTheDocument();
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
      tier: null,
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
      tier: null,
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
      tier: null,
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

    expect(await screen.findByRole('heading', { name: 'KonoSuba TV Anime' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '애니 진행 상황' })).toBeInTheDocument();
    expect(screen.getByLabelText('현재 회')).toBeInTheDocument();
    expect(screen.queryByText('권별 기록')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('권별 별점')).not.toBeInTheDocument();
  });
});
