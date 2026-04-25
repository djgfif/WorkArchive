import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import type { ImportCandidate } from '../../imports/services/imports.service';
import { AuthContext } from '../../auth/context/AuthContext';
import { renderWithProviders } from '../../../test/render-with-providers';
import { workArchiveDbManager } from '../db/work-archive.db';
import { worksRepository } from '../services/works.repository';
import { QuickAddWorkForm } from './QuickAddWorkForm';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildCandidate(
  overrides: Partial<ImportCandidate> = {},
): ImportCandidate {
  const author = overrides.author ?? 'Frank Herbert';
  const sourceId = overrides.sourceId ?? 'aladin';
  const sourceLabel =
    overrides.sourceLabel ??
    (sourceId === 'preview-manual' || sourceId === 'manual'
      ? 'Preview/manual'
      : 'Aladin Book');
  const externalId = overrides.externalId ?? '123';
  const type = overrides.type ?? 'novel';
  const mediumType = overrides.mediumType ?? type;
  const hasExternalIdentity =
    sourceId !== 'preview-manual' && sourceId !== 'manual';

  return {
    author,
    catalogMatch: overrides.catalogMatch ?? null,
    confidence: overrides.confidence ?? 0.86,
    confidenceLabel: overrides.confidenceLabel ?? 'High confidence',
    contributors:
      overrides.contributors ??
      [
        {
          name: author,
          role: 'author',
        },
      ],
    countLabel: overrides.countLabel ?? 'Published 2026-04-18',
    description: overrides.description ?? 'A desert saga.',
    externalId,
    existingRecord: overrides.existingRecord ?? null,
    externalRefs:
      overrides.externalRefs ??
      (hasExternalIdentity
        ? [
            {
              externalId,
              provider: sourceId,
              rawType: 'novel',
              url: `https://example.com/${sourceId}/${externalId}`,
            },
          ]
        : []),
    formatLabel: overrides.formatLabel ?? 'Novel',
    franchiseName: overrides.franchiseName ?? null,
    genresText: overrides.genresText ?? 'Science Fiction, Adventure',
    id: overrides.id ?? `${sourceId}:${externalId}`,
    mediumType,
    note: overrides.note ?? 'Imported from provider',
    reason: overrides.reason ?? 'Title match',
    releaseCandidates: overrides.releaseCandidates ?? [],
    relationsHint: overrides.relationsHint ?? [],
    releaseYear: overrides.releaseYear ?? 2026,
    sourceId,
    sourceLabel,
    sourceUrl:
      overrides.sourceUrl ??
      (hasExternalIdentity ? `https://example.com/${sourceId}/${externalId}` : ''),
    subType: overrides.subType ?? null,
    thumbnailUrl: overrides.thumbnailUrl ?? 'https://example.com/cover.jpg',
    title: overrides.title ?? 'Dune',
    type,
  };
}

function mockAuthenticatedSearchResponse(
  candidates: ImportCandidate[],
  responseOptions: {
    body?: Record<string, unknown>;
    status?: number;
  } = {},
) {
  window.localStorage.setItem(
    'work-archive.auth.tokens',
    JSON.stringify({
      accessToken: 'access-token',
    }),
  );

  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse(
      responseOptions.body ?? {
        provider: 'aladin',
        providers: ['aladin'],
        query: 'Dune',
        candidates,
      },
      responseOptions.status,
    ),
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function renderAuthenticatedQuickAdd(onSubmit = vi.fn()) {
  workArchiveDbManager.switchToUser('user-1');

  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: workArchiveDbManager.getCurrentScopeKey(),
          isLoading: false,
          mode: 'authenticated',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <QuickAddWorkForm
          isSubmitting={false}
          onSubmit={onSubmit}
          submitError={null}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function renderGuestQuickAdd(onSubmit = vi.fn()) {
  workArchiveDbManager.switchToGuest();
  window.localStorage.removeItem('work-archive.auth.tokens');

  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: workArchiveDbManager.getCurrentScopeKey(),
          isLoading: false,
          mode: 'guest',
          user: null,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <QuickAddWorkForm
          isSubmitting={false}
          onSubmit={onSubmit}
          submitError={null}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function buildExistingWork(
  overrides: Partial<WorkRecord> = {},
): WorkRecord {
  const createdAt = overrides.createdAt ?? '2026-04-18T00:00:00.000Z';
  const updatedAt = overrides.updatedAt ?? createdAt;

  return {
    id: overrides.id ?? crypto.randomUUID(),
    catalogTitleId: overrides.catalogTitleId ?? null,
    importDraft: overrides.importDraft ?? null,
    type: overrides.type ?? 'novel',
    title: overrides.title ?? 'Dune',
    author: overrides.author ?? 'Frank Herbert',
    genres: overrides.genres ?? ['Science Fiction'],
    description: overrides.description ?? '',
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    status: overrides.status ?? 'completed',
    rating: overrides.rating ?? 4.5,
    shortReview: overrides.shortReview ?? '',
    review: overrides.review ?? '',
    tier: overrides.tier ?? null,
    favorite: overrides.favorite ?? false,
    progressCurrent: overrides.progressCurrent ?? null,
    progressTotal: overrides.progressTotal ?? null,
    progressUnit: overrides.progressUnit ?? null,
    lastConsumedLabel: overrides.lastConsumedLabel ?? null,
    createdAt,
    updatedAt,
    deletedAt: overrides.deletedAt ?? null,
    syncStatus: overrides.syncStatus ?? 'synced',
    serverVersion: overrides.serverVersion ?? 1,
  };
}

async function seedAuthenticatedExistingWork(
  overrides: Partial<WorkRecord> = {},
) {
  workArchiveDbManager.switchToUser('user-1');

  return worksRepository.create(buildExistingWork(overrides));
}

function getElementById<TElement extends HTMLElement>(id: string) {
  const element = document.getElementById(id);

  expect(element).not.toBeNull();

  return element as TElement;
}

async function searchAndSelectCandidate(
  user: ReturnType<typeof userEvent.setup>,
  searchTerm: string,
  candidateTitle: string,
) {
  await user.click(screen.getByRole('button', { name: '검색으로 추가' }));

  const searchInput = getElementById<HTMLInputElement>('quickAddSearch');

  await user.clear(searchInput);
  await user.type(searchInput, searchTerm);

  const searchForm = searchInput.closest('form');

  expect(searchForm).not.toBeNull();

  const searchButton = searchForm?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );

  expect(searchButton).not.toBeNull();

  await user.click(searchButton!);

  const candidateButton = await waitFor(() => {
    const match = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(candidateTitle),
    );

    expect(match).toBeDefined();

    return match as HTMLButtonElement;
  });

  await user.click(candidateButton);
}

async function submitSelectedCandidate(
  user: ReturnType<typeof userEvent.setup>,
) {
  const titleInput = await waitFor(() => getElementById<HTMLInputElement>('title'));
  const submitForm = titleInput.closest('form');

  expect(submitForm).not.toBeNull();

  const submitButton = submitForm?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );

  expect(submitButton).not.toBeNull();

  await user.click(submitButton!);
}

describe('QuickAddWorkForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('uses authenticated search candidates to prefill the Quick Add form', async () => {
    const candidate = buildCandidate();

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    expect(await waitFor(() => getElementById<HTMLInputElement>('title'))).toHaveValue(
      candidate.title,
    );
    expect(
      screen.getByRole('button', { name: /Dune.*후보 선택/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('개인 기록 입력')).toBeInTheDocument();
    expect(getElementById<HTMLInputElement>('author')).toHaveValue(candidate.author);
    expect(screen.getAllByText(candidate.note).length).toBeGreaterThan(0);
  });

  it('shows direct manual add as the default guest path before search is used', () => {
    renderGuestQuickAdd();

    expect(screen.getByText('검색 없이 작품 기록 만들기')).toBeInTheDocument();
    expect(getElementById<HTMLInputElement>('manualTitle')).toBeInTheDocument();
    expect(getElementById<HTMLSelectElement>('manualType')).toBeInTheDocument();
    expect(document.getElementById('quickAddSearch')).toBeNull();
    expect(
      screen.queryByText(/로그인해야만 검색 가능/),
    ).not.toBeInTheDocument();
  });

  it('submits direct manual adds without catalog or import identity', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAuthenticatedQuickAdd(onSubmit);

    await user.type(getElementById<HTMLInputElement>('manualTitle'), '직접 쓴 작품');
    await user.selectOptions(getElementById<HTMLSelectElement>('manualType'), 'anime');
    await user.click(screen.getByRole('button', { name: '내 아카이브에 저장' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: '직접 쓴 작품',
      type: 'anime',
      catalogTitleId: null,
      importDraft: null,
    });
  });

  it('lets guests submit a minimal manual add without search, candidate selection, or fetch', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    const user = userEvent.setup();

    vi.stubGlobal('fetch', fetchMock);
    renderGuestQuickAdd(onSubmit);

    await user.type(getElementById<HTMLInputElement>('manualTitle'), '게스트 수동 기록');
    await user.selectOptions(getElementById<HTMLSelectElement>('manualType'), 'movie');
    await user.click(screen.getByRole('button', { name: '내 아카이브에 저장' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: '게스트 수동 기록',
      type: 'movie',
      catalogTitleId: null,
      importDraft: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText('검색 결과에서 먼저 작품을 선택해주세요.'),
    ).not.toBeInTheDocument();
  });

  it('uses public no-key provider search for guests', async () => {
    const candidate = buildCandidate({
      sourceId: 'open_library',
      sourceLabel: 'Open Library',
      title: 'Dune',
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library'],
        query: 'Dune',
        candidates: [candidate],
      }),
    );
    const user = userEvent.setup();

    vi.stubGlobal('fetch', fetchMock);
    renderGuestQuickAdd();

    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [firstFetchInput, firstFetchInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(firstFetchInput)).toContain('/imports/search?');
    expect(firstFetchInit).toMatchObject({
      method: 'GET',
    });
    const headers = new Headers((firstFetchInit as RequestInit | undefined)?.headers);

    expect(headers.has('authorization')).toBe(false);
    expect(await waitFor(() => getElementById<HTMLInputElement>('title'))).toHaveValue(
      candidate.title,
    );
  });

  it('offers direct manual add when external search returns no candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library'],
        query: 'No Match Title',
        candidates: [],
      }),
    );
    const user = userEvent.setup();

    vi.stubGlobal('fetch', fetchMock);
    renderGuestQuickAdd();

    await user.click(screen.getByRole('button', { name: '검색으로 추가' }));

    const searchInput = getElementById<HTMLInputElement>('quickAddSearch');

    await user.type(searchInput, 'No Match Title');

    const searchForm = searchInput.closest('form');

    expect(searchForm).not.toBeNull();

    const searchButton = searchForm?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );

    expect(searchButton).not.toBeNull();

    await user.click(searchButton!);

    const manualCta = await screen.findByRole('button', {
      name: '"No Match Title" 직접 추가',
    });

    expect(screen.queryByText(/로그인해야만 검색 가능/)).not.toBeInTheDocument();

    await user.click(manualCta);

    expect(getElementById<HTMLInputElement>('manualTitle')).toHaveValue(
      'No Match Title',
    );
    expect(document.getElementById('quickAddSearch')).toBeNull();
  });

  it('submits catalogTitleId and a null importDraft for matched external candidates', async () => {
    const candidate = buildCandidate({
      catalogMatch: {
        id: 'catalog-title-1',
        title: 'Dune',
        verificationStatus: 'draft',
      },
    });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd(onSubmit);
    await searchAndSelectCandidate(user, 'Dune', candidate.title);
    await submitSelectedCandidate(user);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submittedInput = onSubmit.mock.calls[0]?.[0];

    expect(submittedInput).toMatchObject({
      title: candidate.title,
      type: candidate.type,
      catalogTitleId: 'catalog-title-1',
      importDraft: null,
    });
  });

  it('stores only external identity data in importDraft for unmatched external candidates', async () => {
    const candidate = buildCandidate({
      franchiseName: 'Dune',
      releaseCandidates: [
        {
          displayLabel: 'Volume 1',
          externalRefs: [
            {
              externalId: 'isbn-1',
              provider: 'aladin',
              rawType: 'volume',
              url: 'https://example.com/aladin/volume-1',
            },
          ],
          isbn: '9781234567890',
          releaseDate: '2026-04-18',
          releaseType: 'volume',
          sequence: 1,
          thumbnailUrl: 'https://example.com/volume-1.jpg',
          title: 'Dune Volume 1',
        },
      ],
      subType: 'science_fiction',
    });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd(onSubmit);
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    const titleInput = await waitFor(() => getElementById<HTMLInputElement>('title'));
    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Deluxe');

    await submitSelectedCandidate(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submittedInput = onSubmit.mock.calls[0]?.[0];

    expect(submittedInput).toMatchObject({
      title: 'Dune Deluxe',
      type: 'novel',
      catalogTitleId: null,
      importDraft: {
        mediumType: 'novel',
        franchiseName: 'Dune',
        subType: 'science_fiction',
        releaseYear: 2026,
        contributors: [{ name: candidate.author }],
        externalRefs: [
          {
            externalId: '123',
            provider: 'aladin',
            rawType: 'novel',
            url: 'https://example.com/aladin/123',
          },
        ],
        releaseCandidates: [
          {
            displayLabel: 'Volume 1',
            externalRefs: [
              {
                externalId: 'isbn-1',
                provider: 'aladin',
                rawType: 'volume',
                url: 'https://example.com/aladin/volume-1',
              },
            ],
            isbn: '9781234567890',
            releaseDate: '2026-04-18',
            releaseType: 'volume',
            sequence: 1,
            thumbnailUrl: 'https://example.com/volume-1.jpg',
            title: 'Dune Volume 1',
          },
        ],
      },
    });
    expect(submittedInput.importDraft).not.toHaveProperty('catalogTitle');
    expect(submittedInput.importDraft).not.toHaveProperty('author');
    expect(submittedInput.importDraft).not.toHaveProperty('description');
    expect(submittedInput.importDraft).not.toHaveProperty('thumbnailUrl');
    expect(submittedInput.importDraft).not.toHaveProperty('genres');
  });

  it.each(['preview-manual', 'manual'] as const)(
    'keeps manual draft saves without import identity for %s candidates',
    async (sourceId) => {
      const candidate = buildCandidate({
        sourceId,
        title: sourceId === 'manual' ? 'Custom Dune' : 'Dune Preview',
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      mockAuthenticatedSearchResponse([candidate]);

      const user = userEvent.setup();

      renderAuthenticatedQuickAdd(onSubmit);
      await searchAndSelectCandidate(user, 'Dune', candidate.title);
      await submitSelectedCandidate(user);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      const submittedInput = onSubmit.mock.calls[0]?.[0];

      expect(submittedInput).toMatchObject({
        title: candidate.title,
        type: candidate.type,
        catalogTitleId: null,
        importDraft: null,
      });
    },
  );

  it('shows a duplicate warning when catalog identity matches an existing work', async () => {
    await seedAuthenticatedExistingWork({
        id: 'existing-catalog-match',
        title: 'Dune Local',
        catalogTitleId: 'catalog-title-1',
      });
    const candidate = buildCandidate({
      title: 'Dune (Catalog Match)',
      catalogMatch: {
        id: 'catalog-title-1',
        title: 'Dune',
        verificationStatus: 'draft',
      },
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('a')).some(
          (link) => link.getAttribute('href') === '/works/existing-catalog-match',
        ),
      ).toBe(true);
    });
  });

  it('shows a duplicate warning when external identity matches an existing importDraft', async () => {
    await seedAuthenticatedExistingWork({
        id: 'existing-external-match',
        title: 'Stored External Match',
        importDraft: {
          mediumType: 'novel',
          externalRefs: [
            {
              externalId: '123',
              provider: 'aladin',
              rawType: 'novel',
              url: 'https://example.com/aladin/123',
            },
          ],
        },
      });
    const candidate = buildCandidate({
      title: 'Different Display Title',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();
    await searchAndSelectCandidate(user, 'Different', candidate.title);

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('a')).some(
          (link) => link.getAttribute('href') === '/works/existing-external-match',
        ),
      ).toBe(true);
    });
  });

  it.each(['preview-manual', 'manual'] as const)(
    'keeps title fallback duplicate detection for %s candidates',
    async (sourceId) => {
      await seedAuthenticatedExistingWork({
          id: `existing-${sourceId}-title-match`,
          title: 'Dune',
        });
      const candidate = buildCandidate({
        sourceId,
        title: 'Dune (Special Edition)',
      });

      mockAuthenticatedSearchResponse([candidate]);

      const user = userEvent.setup();

      renderAuthenticatedQuickAdd();
      await searchAndSelectCandidate(user, 'Dune', candidate.title);

      await waitFor(() => {
        expect(
          Array.from(document.querySelectorAll('a')).some(
            (link) =>
              link.getAttribute('href') ===
              `/works/existing-${sourceId}-title-match`,
          ),
        ).toBe(true);
      });
    },
  );

  it('routes duplicate warnings for deleted records to the trash view', async () => {
    await seedAuthenticatedExistingWork({
        id: 'existing-deleted-match',
        title: 'Dune Deleted',
        deletedAt: '2026-04-18T01:00:00.000Z',
        importDraft: {
          mediumType: 'novel',
          externalRefs: [
            {
              externalId: '123',
              provider: 'aladin',
              rawType: 'novel',
              url: 'https://example.com/aladin/123',
            },
          ],
        },
      });
    const candidate = buildCandidate({
      title: 'Dune Deleted Imported',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('a')).some(
          (link) =>
            link.getAttribute('href') ===
            '/works?scope=trash&q=Dune%20Deleted',
        ),
      ).toBe(true);
    });
  });

  it('falls back to preview candidates when authenticated external search is unavailable', async () => {
    mockAuthenticatedSearchResponse([], {
      body: {
        message: 'Aladin API key is not configured for this user.',
      },
      status: 403,
    });

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();
    await searchAndSelectCandidate(user, 'Dune', 'Dune');

    expect(await waitFor(() => getElementById<HTMLInputElement>('title'))).toHaveValue(
      'Dune',
    );
  });
});
