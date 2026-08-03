import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import type { ImportCandidate } from '@features/imports';
import {
  archiveHealthReviewSessionService,
  buildArchiveHealthEditUrl,
} from '../services/archive-health-review-session.service';
import { worksService } from '../services/works.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status,
  });
}

function buildCandidate(title = 'Dune'): ImportCandidate {
  return {
    author: 'Frank Herbert',
    catalogMatch: null,
    confidence: 0.68,
    confidenceLabel: 'Open Library 후보',
    contributors: [
      {
        name: 'Frank Herbert',
        role: 'author',
      },
    ],
    countLabel: '1965',
    description: 'A desert saga.',
    existingRecord: null,
    externalId: '/works/OL123W',
    externalRefs: [
      {
        externalId: '/works/OL123W',
        provider: 'open_library',
        rawType: 'novel',
        url: 'https://openlibrary.org/works/OL123W',
      },
    ],
    formatLabel: '소설/도서',
    franchiseName: null,
    genresText: '',
    id: 'open_library:/works/OL123W',
    mediumType: 'novel',
    note: 'Open Library Search API',
    reason: 'Open Library 제목 검색 결과',
    releaseCandidates: [],
    relationsHint: [],
    releaseYear: 1965,
    sourceId: 'open_library',
    sourceLabel: 'Open Library',
    sourceUrl: 'https://openlibrary.org/works/OL123W',
    subType: null,
    thumbnailUrl: '',
    title,
    type: 'novel',
  };
}

function getMockApiPath(input: RequestInfo | URL) {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const url = new URL(rawUrl, 'http://work-archive.test');

  return url.pathname.replace(/^\/api(?=\/|$)/, '');
}

function mockSearch(candidate = buildCandidate()) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const apiPath = getMockApiPath(input);

      if (apiPath === '/auth/refresh') {
        return Promise.resolve(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        );
      }

      if (apiPath === '/imports/providers') {
        return Promise.resolve(jsonResponse([]));
      }

      if (apiPath === '/imports/search') {
        return Promise.resolve(
          jsonResponse({
            provider: 'open_library',
            providers: ['open_library'],
            query: candidate.title,
            candidates: [candidate],
          }),
        );
      }

      throw new Error(`Unexpected fetch request in WorkFlow test: ${apiPath}`);
    }),
  );
}

describe('Works routed flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates and edits a work through the UI', async () => {
    const title = `Dune routed ${crypto.randomUUID().slice(0, 8)}`;
    const updatedTitle = `${title} Messiah`;

    mockSearch(buildCandidate(title));

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(await screen.findByLabelText('검색으로 정보 보강(선택)'));
    await user.type(await screen.findByLabelText(/^작품 검색$/), title);
    await user.click(screen.getByRole('button', { name: '후보 검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );
    expect(
      await screen.findByRole('button', { name: /Dune.*후보 선택/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(
      screen.getByRole('button', { name: '이 후보로 입력 채우기' }),
    );

    const createTitleInput = await screen.findByLabelText(/^제목$/);
    fireEvent.change(createTitleInput, { target: { value: title } });
    await user.click(screen.getByRole('button', { name: '상세 정보' }));
    const authorInput = document.getElementById(
      'manualCreatorText',
    ) as HTMLInputElement;
    expect(authorInput).not.toBeNull();
    fireEvent.change(authorInput, { target: { value: 'Frank Herbert' } });
    await user.click(screen.getByRole('button', { name: '완료' }));

    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );
    expect(
      await screen.findByText(
        `${title}을(를) 등록했습니다`,
        {},
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    const createdWork = (
      await worksService.listWorks(DEFAULT_WORKS_LIST_QUERY, 'active')
    ).works.find((work) => work.title === title);

    expect(createdWork).toEqual(expect.objectContaining({ title }));
    await act(async () => {
      await router.navigate(`/works/${createdWork!.id}`);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/works/${createdWork!.id}`);
    });

    expect(
      await screen.findByRole('heading', { name: title }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Frank Herbert/i).length).toBeGreaterThan(0);

    await user.click(
      await screen.findByRole(
        'link',
        { name: '전체 정보 수정' },
        { timeout: 10_000 },
      ),
    );

    const titleInput = await screen.findByLabelText(/^제목$/);

    fireEvent.change(titleInput, { target: { value: updatedTitle } });
    expect(
      screen.getByRole('button', { name: '저장 하단 고정 저장' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByRole(
        'heading',
        { name: updatedTitle },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
  }, 30_000);

  it('reviews health issues across records and returns to settings', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const firstWork = await worksService.createWork({
      author: '',
      completedAt: null,
      description: '',
      favorite: false,
      genres: [],
      personalTags: [],
      rating: null,
      review: '',
      shortReview: '',
      status: 'completed',
      thumbnailUrl: 'https://example.com/health-completed.jpg',
      title: `완료일 검토 ${suffix}`,
      type: 'novel',
    });
    const secondWork = await worksService.createWork({
      author: '',
      description: '',
      droppedAt: null,
      favorite: false,
      genres: [],
      personalTags: [],
      rating: null,
      review: '',
      shortReview: '',
      status: 'dropped',
      thumbnailUrl: 'https://example.com/health-dropped.jpg',
      title: `중단일 검토 ${suffix}`,
      type: 'novel',
    });
    const reviewSession = archiveHealthReviewSessionService.create([
      {
        issueCodes: ['completed_without_date'],
        workId: firstWork.id,
      },
      {
        issueCodes: ['dropped_without_date'],
        workId: secondWork.id,
      },
    ]);
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [
        buildArchiveHealthEditUrl(firstWork.id, {
          issueCodes: ['completed_without_date'],
          reviewSessionId: reviewSession!.id,
        }),
      ],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: `${firstWork.title} 건강검진`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText(/완료일이 비어 있습니다/)).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText(/^완료일$/), {
      target: { value: '2026-07-01' },
    });
    await user.click(screen.getByRole('button', { name: '저장하고 다음 기록' }));

    expect(
      await screen.findByRole('heading', {
        name: `${secondWork.title} 건강검진`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(
      screen.getByText('이전 기록을 저장했습니다. 다음 항목을 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/중단일이 비어 있습니다/)).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText(/^하차일$/), {
      target: { value: '2026-07-02' },
    });
    await user.click(screen.getByRole('button', { name: '저장하고 검토 완료' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/account/settings');
      expect(router.state.location.hash).toBe('#archive-health');
    });
    await expect(worksService.getWorkById(firstWork.id)).resolves.toMatchObject(
      { completedAt: '2026-07-01T00:00:00.000Z' },
    );
    await expect(
      worksService.getWorkById(secondWork.id),
    ).resolves.toMatchObject({
      droppedAt: '2026-07-02T00:00:00.000Z',
      title: secondWork.title,
    });
  }, 30_000);

  it('keeps manual create local and shows field feedback before save', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(
      await screen.findByRole('button', { name: '내 아카이브에 저장' }),
    );

    expect(await screen.findAllByText('제목을 입력해주세요.')).not.toHaveLength(
      0,
    );
    expect(await screen.findByLabelText(/^제목$/)).toHaveFocus();
  });

  it('warns when a likely duplicate already exists before continuing', async () => {
    mockSearch();

    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'completed',
      rating: 4.5,
      shortReview: '',
      review: '',
      favorite: false,
    });

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(await screen.findByLabelText('검색으로 정보 보강(선택)'));
    await user.type(await screen.findByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '후보 검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    expect(
      await screen.findByText('비슷한 기록이 이미 있습니다'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '이 후보로 입력 채우기' }),
    );

    expect(await screen.findByLabelText(/^제목$/)).toBeInTheDocument();
  });
});
