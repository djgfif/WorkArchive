import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import type { ImportCandidate } from '../../imports/services/imports.service';
import { worksService } from '../services/works.service';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
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

    await user.click(screen.getByRole('button', { name: '검색으로 정보 채우기' }));
    await user.type(await screen.findByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '다시 검색' }));
    await user.click((await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!);
    await screen.findByText('검색 근거');
    await user.click(screen.getByRole('button', { name: '이 후보로 입력 채우기' }));

    const createTitleInput = await screen.findByLabelText(/^제목$/);
    await user.clear(createTitleInput);
    await user.type(createTitleInput, 'Dune');
    const authorInput = screen.getByLabelText(/작가·제작자/);
    await user.clear(authorInput);
    await user.type(authorInput, 'Frank Herbert');
    await user.click(screen.getByRole('button', { name: '완료' }));

    await user.click(screen.getByRole('button', { name: '내 아카이브에 저장' }));
    await user.click(await screen.findByRole('button', { name: '방금 등록한 작품 보기' }));

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getAllByText(/Frank Herbert/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: '수정' }));

    const titleInput = await screen.findByLabelText(/^제목$/);

    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Messiah');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('heading', { name: 'Dune Messiah' })).toBeInTheDocument();
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
      tier: null,
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

    await user.click(screen.getByRole('button', { name: '검색으로 정보 채우기' }));
    await user.type(await screen.findByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '다시 검색' }));
    await user.click((await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!);

    expect(await screen.findByText('비슷한 기록이 이미 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '이 후보로 입력 채우기' }));

    expect(await screen.findByLabelText(/^제목$/)).toBeInTheDocument();
  });
});
