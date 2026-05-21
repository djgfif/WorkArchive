import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ImportCandidate } from '../../imports/services/imports.service';
import { AuthContext } from '../../auth/context/AuthContext';
import {
  clearStoredAuthTokens,
  writeStoredAuthTokens,
} from '../../auth/services/auth-storage';
import { syncQueueRepository } from '../../sync/services/sync-queue.repository';
import { renderWithProviders } from '../../../test/render-with-providers';
import { workArchiveDbManager } from '../db/work-archive.db';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';
import { WorkCreatePage } from './WorkCreatePage';

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
    contributors: overrides.contributors ?? [
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
      (hasExternalIdentity
        ? `https://example.com/${sourceId}/${externalId}`
        : ''),
    subType: overrides.subType ?? null,
    thumbnailUrl: overrides.thumbnailUrl ?? 'https://example.com/cover.jpg',
    title: overrides.title ?? 'Dune',
    type,
  };
}

function getElementById<TElement extends HTMLElement>(id: string) {
  const element = document.getElementById(id);

  expect(element).not.toBeNull();

  return element as TElement;
}

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function mockAuthenticatedSearch(candidate: ImportCandidate) {
  writeStoredAuthTokens({
    accessToken: 'access-token',
  });

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getFetchUrl(input);

      if (url.includes('/imports/search?')) {
        return jsonResponse({
          provider: 'aladin',
          providers: ['aladin'],
          query: 'Dune',
          candidates: [candidate],
        });
      }

      if (url.includes('/imports/providers')) {
        return jsonResponse([]);
      }

      throw new Error(
        `Unexpected fetch during create flow: ${init?.method ?? 'GET'} ${url}`,
      );
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function getSearchFetchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) =>
    getFetchUrl(input as RequestInfo | URL).includes('/imports/search?'),
  );
}

async function getQueuedWorkItems() {
  return (await syncQueueRepository.listAll()).filter(
    (item) => item.entityType === 'work',
  );
}

function renderAuthenticatedCreatePage() {
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
          signOut: vi.fn(),
        }}
      >
        <WorkCreatePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function renderGuestCreatePage() {
  workArchiveDbManager.switchToGuest();

  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: workArchiveDbManager.getCurrentScopeKey(),
          isLoading: false,
          mode: 'guest',
          user: null,
          signOut: vi.fn(),
        }}
      >
        <WorkCreatePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function searchAndSelectCandidate(
  user: ReturnType<typeof userEvent.setup>,
  searchTerm: string,
  candidateTitle: string,
  options: { providerGroup?: 'manual' } = {},
) {
  await user.click(
    screen.getByLabelText('검색으로 채우기'),
  );

  if (options.providerGroup === 'manual') {
    const manualProviderGroupButton = await waitFor(() => {
      const match = Array.from(document.querySelectorAll('button')).find(
        (button) =>
          button.textContent?.includes('직접 추가') && button.closest('form'),
      );

      expect(match).toBeDefined();

      return match as HTMLButtonElement;
    });

    await user.click(manualProviderGroupButton);
  }

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
    const match = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes(candidateTitle),
    );

    expect(match).toBeDefined();

    return match as HTMLButtonElement;
  });

  await user.click(candidateButton);
  await user.click(
    screen.getByRole('button', {
      name:
        options.providerGroup === 'manual'
          ? '직접 추가로 입력 채우기'
          : '이 후보로 입력 채우기',
    }),
  );
}

async function submitSelectedCandidate(
  user: ReturnType<typeof userEvent.setup>,
) {
  const titleInput = await waitFor(() =>
    getElementById<HTMLInputElement>('manualTitle'),
  );
  const submitForm = titleInput.closest('form');

  expect(submitForm).not.toBeNull();

  await user.click(screen.getByRole('button', { name: '내 아카이브에 저장' }));
}

describe('WorkCreatePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    window.localStorage.clear();
  });

  it('autosaves, restores, and discards manual create drafts locally', async () => {
    const user = userEvent.setup();
    const firstView = renderGuestCreatePage();

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      'Draft Dune',
    );

    expect(await screen.findByText('임시저장됨')).toBeInTheDocument();
    expect(
      Object.keys(window.localStorage).some((key) =>
        key.includes('work-form-draft'),
      ),
    ).toBe(true);

    firstView.unmount();
    const secondView = renderGuestCreatePage();

    expect(await screen.findByText('임시작성 있음')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이어서 작성하기' }));
    expect(getElementById<HTMLInputElement>('manualTitle')).toHaveValue(
      'Draft Dune',
    );

    secondView.unmount();
    renderGuestCreatePage();

    expect(await screen.findByText('임시작성 있음')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '임시작성 삭제' }));
    expect(screen.queryByText('임시작성 있음')).not.toBeInTheDocument();
    expect(
      Object.keys(window.localStorage).some((key) =>
        key.includes('work-form-draft'),
      ),
    ).toBe(false);
  });

  it('clears the create draft after a successful local save', async () => {
    const user = userEvent.setup();

    renderGuestCreatePage();

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      'Saved Draft Work',
    );
    expect(await screen.findByText('임시저장됨')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );

    expect(await screen.findByText('로컬에 저장됨')).toBeInTheDocument();
    expect(
      Object.keys(window.localStorage).some((key) =>
        key.includes('work-form-draft'),
      ),
    ).toBe(false);
  });

  it('warns before internal navigation when a create form has unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    renderGuestCreatePage();

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      'Unsaved Work',
    );
    expect(await screen.findByText('임시저장됨')).toBeInTheDocument();

    const backLink = document.querySelector<HTMLAnchorElement>('a[href="/works"]');

    expect(backLink).not.toBeNull();
    await user.click(backLink!);

    expect(confirmSpy).toHaveBeenCalledWith(
      '저장되지 않은 변경 사항이 있습니다. 이 페이지를 떠나시겠습니까?',
    );
  });

  it('shows duplicate title candidates while typing a new work title', async () => {
    workArchiveDbManager.switchToGuest();
    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
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

    renderGuestCreatePage();

    await user.type(getElementById<HTMLInputElement>('manualTitle'), 'Dune');

    expect(
      await screen.findByText('비슷한 기록이 있습니다'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Frank Herbert/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: '기존 작품 보기' }),
    ).toHaveAttribute('href', expect.stringContaining('/works/'));
  });

  it('lets a guest save a direct manual work locally without import identity', async () => {
    const user = userEvent.setup();

    renderGuestCreatePage();

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      '게스트 직접 추가',
    );
    await user.selectOptions(
      getElementById<HTMLSelectElement>('manualType'),
      'movie',
    );
    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );

    await waitFor(async () => {
      expect(await worksRepository.listAll()).toHaveLength(1);
    });

    const [savedWork] = await worksRepository.listAll();
    const queueItems = await syncQueueRepository.listAll();

    expect(savedWork).toMatchObject({
      title: '게스트 직접 추가',
      type: 'movie',
      catalogTitleId: null,
      importDraft: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    });
    expect(
      await screen.findByText('게스트 직접 추가을(를) 등록했습니다'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '방금 등록한 작품 보기' }),
    ).toBeInTheDocument();
    expect(queueItems).toEqual([
      expect.objectContaining({
        entityId: savedWork?.id,
        operation: 'create',
        source: 'manual_create',
        payload: expect.objectContaining({
          catalogTitleId: null,
          importDraft: null,
        }),
      }),
    ]);
  });

  it('keeps authenticated matched search saves on the Dexie to syncQueue path', async () => {
    const candidate = buildCandidate({
      catalogMatch: {
        id: 'catalog-title-1',
        title: 'Dune',
        verificationStatus: 'draft',
      },
    });
    const fetchMock = mockAuthenticatedSearch(candidate);
    const user = userEvent.setup();

    renderAuthenticatedCreatePage();
    await searchAndSelectCandidate(user, 'Dune', candidate.title);
    await submitSelectedCandidate(user);

    await waitFor(async () => {
      expect(await worksRepository.listAll()).toHaveLength(1);
      expect(await getQueuedWorkItems()).toHaveLength(1);
    });

    const [savedWork] = await worksRepository.listAll();
    const [queueItem] = await getQueuedWorkItems();

    expect(savedWork).toMatchObject({
      title: 'Dune',
      catalogTitleId: 'catalog-title-1',
      importDraft: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    });
    expect(queueItem).toMatchObject({
      entityId: savedWork?.id,
      operation: 'create',
      source: 'quick_add',
      payload: expect.objectContaining({
        id: savedWork?.id,
        catalogTitleId: 'catalog-title-1',
        importDraft: null,
      }),
    });
    expect(getSearchFetchCalls(fetchMock)).toHaveLength(1);
    const [firstFetchInput, firstFetchInit] =
      getSearchFetchCalls(fetchMock)[0] ?? [];

    expect(firstFetchInput).toBeDefined();
    expect(firstFetchInit).toBeDefined();
    expect(getFetchUrl(firstFetchInput as RequestInfo | URL)).toContain(
      '/imports/search?',
    );
    expect(firstFetchInit).toMatchObject({
      method: 'GET',
    });
  });

  it('stores unmatched external identity locally without duplicating display fields in importDraft', async () => {
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
    const fetchMock = mockAuthenticatedSearch(candidate);
    const user = userEvent.setup();

    renderAuthenticatedCreatePage();
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    const titleInput = await waitFor(() =>
      getElementById<HTMLInputElement>('manualTitle'),
    );
    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Deluxe');

    await submitSelectedCandidate(user);

    await waitFor(async () => {
      expect(await worksRepository.listAll()).toHaveLength(1);
      expect(await getQueuedWorkItems()).toHaveLength(1);
    });

    const [savedWork] = await worksRepository.listAll();
    const [queueItem] = await getQueuedWorkItems();

    expect(savedWork).toMatchObject({
      title: 'Dune Deluxe',
      catalogTitleId: null,
      importDraft: {
        mediumType: 'novel',
        franchiseName: 'Dune',
        subType: 'science_fiction',
        releaseYear: 2026,
        contributors: [{ name: 'Frank Herbert' }],
        externalRefs: [
          {
            externalId: '123',
            provider: 'aladin',
            rawType: 'novel',
            url: 'https://example.com/aladin/123',
          },
        ],
      },
      syncStatus: 'local-only',
      serverVersion: 0,
    });
    expect(savedWork?.importDraft).not.toHaveProperty('catalogTitle');
    expect(savedWork?.importDraft).not.toHaveProperty('author');
    expect(savedWork?.importDraft).not.toHaveProperty('description');
    expect(savedWork?.importDraft).not.toHaveProperty('thumbnailUrl');
    expect(savedWork?.importDraft).not.toHaveProperty('genres');
    expect(queueItem).toMatchObject({
      entityId: savedWork?.id,
      operation: 'create',
      source: 'quick_add',
      payload: expect.objectContaining({
        id: savedWork?.id,
        title: 'Dune Deluxe',
        catalogTitleId: null,
        importDraft: expect.objectContaining({
          mediumType: 'novel',
        }),
      }),
    });
    expect(getSearchFetchCalls(fetchMock)).toHaveLength(1);
  });

  it.each(['preview-manual', 'manual'] as const)(
    'keeps %s saves on the local-first path without import identity',
    async (sourceId) => {
      const candidate = buildCandidate({
        sourceId,
        title: sourceId === 'manual' ? 'Custom Dune' : 'Dune Preview',
      });
      const fetchMock = mockAuthenticatedSearch(candidate);
      const user = userEvent.setup();

      renderAuthenticatedCreatePage();
      await searchAndSelectCandidate(user, 'Dune', candidate.title, {
        ...(sourceId === 'manual' || sourceId === 'preview-manual'
          ? { providerGroup: 'manual' as const }
          : {}),
      });
      await submitSelectedCandidate(user);

      await waitFor(async () => {
        expect(await worksRepository.listAll()).toHaveLength(1);
        expect(await getQueuedWorkItems()).toHaveLength(1);
      });

      const [savedWork] = await worksRepository.listAll();
      const [queueItem] = await getQueuedWorkItems();

      expect(savedWork).toMatchObject({
        title: candidate.title,
        catalogTitleId: null,
        importDraft: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      });
      expect(queueItem).toMatchObject({
        entityId: savedWork?.id,
        operation: 'create',
        source: 'manual_create',
        payload: expect.objectContaining({
          id: savedWork?.id,
          title: candidate.title,
          catalogTitleId: null,
          importDraft: null,
        }),
      });
      expect(getSearchFetchCalls(fetchMock)).toHaveLength(1);
    },
  );
});
