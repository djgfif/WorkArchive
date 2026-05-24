import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth';
import type { ImportCandidate } from '../../imports';
import { worksService } from '../services/works.service';

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

function mockSearch(candidate = buildCandidate()) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        );
      }

      if (url.includes('/imports/providers')) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(
        jsonResponse({
          provider: 'open_library',
          providers: ['open_library'],
          query: candidate.title,
          candidates: [candidate],
        }),
      );
    }),
  );
}

describe('Works routed flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates and edits a work through the UI', async () => {
    mockSearch();

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(await screen.findByLabelText('검색으로 채우기'));
    await user.type(await screen.findByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click((await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!);
    expect(
      await screen.findByRole('button', { name: /Dune.*후보 선택/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '이 후보로 입력 채우기' }));

    const createTitleInput = await screen.findByLabelText(/^제목$/);
    await user.clear(createTitleInput);
    await user.type(createTitleInput, 'Dune');
    await user.click(screen.getByRole('button', { name: '상세 정보' }));
    const authorInput = document.getElementById('manualCreatorText') as HTMLInputElement;
    expect(authorInput).not.toBeNull();
    await user.clear(authorInput);
    await user.type(authorInput, 'Frank Herbert');
    await user.click(screen.getByRole('button', { name: '완료' }));

    await user.click(screen.getByRole('button', { name: '내 아카이브에 저장' }));
    expect(
      await screen.findByText(/Dune을\(를\) 등록했습니다/, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole(
        'button',
        { name: '방금 등록한 작품 보기' },
        { timeout: 10_000 },
      ),
    );

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getAllByText(/Frank Herbert/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: '전체 정보 수정' }));

    const titleInput = await screen.findByLabelText(/^제목$/);

    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Messiah');
    expect(
      screen.getByRole('button', { name: '저장 하단 고정 저장' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('heading', { name: 'Dune Messiah' })).toBeInTheDocument();
  }, 20_000);

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

    expect(await screen.findAllByText('제목을 입력해주세요.')).not.toHaveLength(0);
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

    await user.click(await screen.findByLabelText('검색으로 채우기'));
    await user.type(await screen.findByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click((await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!);

    expect(await screen.findByText('비슷한 기록이 이미 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '이 후보로 입력 채우기' }));

    expect(await screen.findByLabelText(/^제목$/)).toBeInTheDocument();
  });
});
