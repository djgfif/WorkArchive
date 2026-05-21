import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import type { ImportCandidate } from '../../imports/services/imports.service';
import { AuthContext } from '../../auth/context/AuthContext';
import {
  clearStoredAuthTokens,
  writeStoredAuthTokens,
} from '../../auth/services/auth-storage';
import { renderWithProviders } from '../../../test/render-with-providers';
import { workArchiveDbManager } from '../db/work-archive.db';
import { worksRepository } from '../services/works.repository';
import { AddWorkFlow } from './AddWorkFlow';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

const providerStatuses = [
  {
    provider: 'manual',
    label: 'Manual',
    credentialMode: 'none',
    configured: true,
    mediumTypes: ['novel'],
  },
  {
    provider: 'anilist',
    label: 'AniList',
    credentialMode: 'none',
    configured: true,
    mediumTypes: ['anime', 'manga'],
  },
  {
    provider: 'google_books',
    label: 'Google Books',
    credentialMode: 'none',
    configured: true,
    mediumTypes: ['novel'],
  },
  {
    provider: 'open_library',
    label: 'Open Library',
    credentialMode: 'none',
    configured: true,
    mediumTypes: ['novel'],
  },
  {
    provider: 'tvmaze',
    label: 'TVmaze',
    credentialMode: 'none',
    configured: true,
    mediumTypes: ['drama'],
  },
  {
    provider: 'aladin',
    label: 'Aladin Book',
    credentialMode: 'user',
    configured: false,
    mediumTypes: ['novel'],
  },
  {
    provider: 'tmdb',
    label: 'TMDB',
    credentialMode: 'user',
    configured: false,
    credentialFields: [
      { name: 'readToken', label: 'Read Access Token', secret: true },
    ],
    mediumTypes: ['movie', 'drama'],
  },
  {
    provider: 'naver_book',
    label: 'Naver Book',
    credentialMode: 'user',
    configured: false,
    credentialFields: [
      { name: 'clientId', label: 'Client ID', secret: true },
      { name: 'clientSecret', label: 'Client Secret', secret: true },
    ],
    mediumTypes: ['novel'],
  },
  {
    provider: 'kakao_book',
    label: 'Kakao Book',
    credentialMode: 'user',
    configured: false,
    credentialFields: [
      { name: 'restApiKey', label: 'REST API Key', secret: true },
    ],
    mediumTypes: ['novel'],
  },
  {
    provider: 'kobis',
    label: 'KOBIS',
    credentialMode: 'user',
    configured: false,
    credentialFields: [{ name: 'apiKey', label: 'API Key', secret: true }],
    mediumTypes: ['movie'],
  },
];

function mockImportsFetch({
  candidates = [],
  provider = 'open_library',
  responseOptions = {},
}: {
  candidates?: ImportCandidate[];
  provider?: string;
  responseOptions?: {
    body?: Record<string, unknown>;
    status?: number;
  };
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url.includes('/imports/providers')) {
      return Promise.resolve(jsonResponse(providerStatuses));
    }

    return Promise.resolve(
      jsonResponse(
        responseOptions.body ?? {
          provider,
          providers: [provider],
          query: 'Dune',
          candidates,
        },
        responseOptions.status,
      ),
    );
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
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
    ...(overrides.scoreBreakdown
      ? { scoreBreakdown: overrides.scoreBreakdown }
      : {}),
    ...(overrides.sourceCoverage
      ? { sourceCoverage: overrides.sourceCoverage }
      : {}),
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
    ...(overrides.titleAliases ? { titleAliases: overrides.titleAliases } : {}),
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
  writeStoredAuthTokens({
    accessToken: 'access-token',
  });

  return mockImportsFetch({
    candidates,
    provider: 'aladin',
    responseOptions,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function renderAuthenticatedAddWorkFlow(onSubmit = vi.fn()) {
  workArchiveDbManager.switchToUser('user-1');

  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: workArchiveDbManager.getCurrentScopeKey(),
          isLoading: false,
          mode: 'authenticated',
          user: {
            avatarUrl: '',
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
          signOut: vi.fn(),
        }}
      >
        <AddWorkFlow
          isSubmitting={false}
          onSubmit={onSubmit}
          submitError={null}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function renderGuestAddWorkFlow(onSubmit = vi.fn()) {
  workArchiveDbManager.switchToGuest();
  clearStoredAuthTokens();

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
        <AddWorkFlow
          isSubmitting={false}
          onSubmit={onSubmit}
          submitError={null}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function buildExistingWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
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
    personalTags: overrides.personalTags ?? [],
    description: overrides.description ?? '',
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    status: overrides.status ?? 'completed',
    rating: overrides.rating ?? 4.5,
    shortReview: overrides.shortReview ?? '',
    review: overrides.review ?? '',
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

async function openSearchPicker(
  user: ReturnType<typeof userEvent.setup>,
  searchTerm: string,
) {
  await user.click(screen.getByLabelText('검색으로 채우기'));

  const searchInput = await screen.findByLabelText(/^작품 검색$/);

  await user.clear(searchInput);
  await user.type(searchInput, searchTerm);

  const searchForm = searchInput.closest('form');

  expect(searchForm).not.toBeNull();

  const searchButton = searchForm?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );

  expect(searchButton).not.toBeNull();

  await user.click(searchButton!);
}

async function selectManualProviderGroup(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(await screen.findByRole('button', { name: '검색 설정' }));

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

async function selectCandidateRow(
  user: ReturnType<typeof userEvent.setup>,
  candidateTitle: string,
) {
  const candidateButton = await waitFor(() => {
    const match = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes(candidateTitle),
    );

    expect(match).toBeDefined();

    return match as HTMLButtonElement;
  });

  await user.click(candidateButton);
}

async function searchAndSelectCandidate(
  user: ReturnType<typeof userEvent.setup>,
  searchTerm: string,
  candidateTitle: string,
) {
  await openSearchPicker(user, searchTerm);
  await selectCandidateRow(user, candidateTitle);
  await user.click(
    screen.getByRole('button', { name: '이 후보로 입력 채우기' }),
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

describe('AddWorkFlow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearStoredAuthTokens();
    window.localStorage.clear();
  });

  it('uses authenticated search candidates to prefill the Add Work form', async () => {
    const candidate = buildCandidate({
      confidenceLabel: '신뢰도 높음',
      reason: '제목 정확히 일치 · 카탈로그 매칭됨',
      releaseCandidates: [
        {
          displayLabel: 'Volume 1',
          externalRefs: [
            {
              externalId: 'volume-1',
              provider: 'aladin',
              rawType: 'volume',
              url: 'https://example.com/aladin/volume-1',
            },
          ],
          isbn: '9781234567890',
          releaseDate: '2026-04-18',
          releaseType: 'volume',
          sequence: 1,
          title: 'Dune Volume 1',
        },
      ],
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await user.click(screen.getByLabelText('검색으로 채우기'));
    await user.type(getElementById<HTMLInputElement>('quickAddSearch'), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    expect(
      screen.getByRole('button', { name: /Dune.*후보 선택/ }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(
      screen.getByRole('button', { name: '이 후보로 입력 채우기' }),
    );

    expect(
      await waitFor(() => getElementById<HTMLInputElement>('manualTitle')),
    ).toHaveValue(candidate.title);
    expect(getElementById<HTMLInputElement>('manualAuthor')).toHaveValue(
      candidate.author,
    );
  });

  it('shows structured loading while search candidates are loading', async () => {
    const candidate = buildCandidate();
    const searchResponse = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/imports/providers')) {
        return Promise.resolve(jsonResponse(providerStatuses));
      }

      return searchResponse.promise;
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderGuestAddWorkFlow();

    await openSearchPicker(user, 'Dune');

    await waitFor(() => {
      expect(screen.getByTestId('candidate-search-loading')).toHaveAttribute(
      'aria-busy',
      'true',
      );
    });

    searchResponse.resolve(
      jsonResponse({
        provider: 'open_library',
        providers: ['open_library'],
        query: 'Dune',
        candidates: [candidate],
      }),
    );

    expect(
      await screen.findByRole('button', { name: /Dune.*후보 선택/ }),
    ).toBeInTheDocument();
  });

  it('submits genres and personal tags from chip inputs', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderGuestAddWorkFlow(onSubmit);

    await user.type(getElementById<HTMLInputElement>('manualTitle'), 'Dune');
    await user.click(screen.getByRole('button', { name: /감상 기록|상세/ }));
    await user.type(
      getElementById<HTMLInputElement>('manualGenresText'),
      'Science Fiction{Enter}Adventure{Enter}',
    );
    await user.type(
      getElementById<HTMLInputElement>('manualPersonalTagsText'),
      'rewatch{Enter}quiet ending{Enter}',
    );
    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      genres: ['Science Fiction', 'Adventure'],
      personalTags: ['rewatch', 'quiet ending'],
      title: 'Dune',
    });
  });

  it('shows merged provider source coverage for search candidates', async () => {
    const candidate = buildCandidate({
      confidenceLabel: 'ISBN 확인됨',
      externalId: 'gb-1',
      externalRefs: [
        {
          externalId: 'gb-1',
          provider: 'google_books',
          rawType: 'book',
          url: 'https://example.com/google-books/gb-1',
        },
        {
          externalId: 'ol-1',
          provider: 'open_library',
          rawType: 'book',
          url: 'https://example.com/open-library/ol-1',
        },
      ],
      reason: 'Google Books / Open Library에서 같은 ISBN 확인',
      releaseCandidates: [
        {
          displayLabel: 'ISBN edition',
          externalRefs: [
            {
              externalId: 'isbn-9781234567890',
              provider: 'open_library',
              rawType: 'isbn',
              url: 'https://example.com/open-library/isbn',
            },
          ],
          isbn: '9781234567890',
          releaseType: 'book',
          title: 'Dune',
        },
      ],
      sourceId: 'google_books',
      sourceLabel: 'Google Books',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await user.click(screen.getByLabelText('검색으로 채우기'));
    await user.type(getElementById<HTMLInputElement>('quickAddSearch'), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    expect(screen.getAllByText('Google Books').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open Library').length).toBeGreaterThan(0);
  });

  it('shows backend search aliases and score reasons in candidate preview', async () => {
    const candidate = buildCandidate({
      scoreBreakdown: [
        {
          label: '별칭 제목 일치',
          weight: 32,
        },
        {
          label: '출처 신뢰도',
          weight: 8,
        },
      ],
      sourceCoverage: {
        externalIdentityCount: 4,
        providerCount: 2,
        providers: ['anilist', 'tmdb'],
        releaseCandidateCount: 1,
      },
      sourceId: 'anilist',
      sourceLabel: 'AniList',
      title: 'Steins;Gate',
      titleAliases: ['Steins;Gate', 'シュタインズ・ゲート', '슈타인즈 게이트'],
      type: 'anime',
      mediumType: 'anime',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await user.click(screen.getByLabelText('검색으로 채우기'));
    await user.type(
      getElementById<HTMLInputElement>('quickAddSearch'),
      '슈타인즈 게이트',
    );
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    expect(screen.getByText('シュタインズ・ゲート')).toBeInTheDocument();
    expect(screen.getByText('슈타인즈 게이트')).toBeInTheDocument();
  });

  it('keeps low-confidence search candidates selectable', async () => {
    const candidate = buildCandidate({
      confidence: 0.41,
      confidenceLabel: '검토 필요',
      reason: '제목만 있는 약한 후보',
      scoreBreakdown: [
        {
          label: '제목 토큰 일치',
          weight: 6,
        },
        {
          label: '제목만 있는 약한 후보',
          weight: -10,
        },
      ],
      sourceId: 'open_library',
      sourceLabel: 'Open Library',
      title: 'Dune Archive Notes',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await user.click(screen.getByLabelText('검색으로 채우기'));
    await user.type(getElementById<HTMLInputElement>('quickAddSearch'), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(
      (await screen.findAllByRole('button', { name: /후보 선택$/ }))[0]!,
    );

    expect(
      screen.getByRole('button', { name: /Dune Archive Notes.*후보 선택/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '직접 추가로 계속' }),
    ).toBeInTheDocument();
  });

  it('shows direct manual add as the default guest path before search is used', () => {
    renderGuestAddWorkFlow();

    expect(screen.getByLabelText('직접 입력')).toBeChecked();
    expect(getElementById<HTMLInputElement>('manualTitle')).toBeInTheDocument();
    expect(getElementById<HTMLSelectElement>('manualType')).toBeInTheDocument();
    expect(document.getElementById('quickAddSearch')).toBeNull();
    expect(
      screen.queryByText(/로그인해야만 검색 가능/),
    ).not.toBeInTheDocument();
  });

  it('shows provider readiness in guest search mode without making search login-only', async () => {
    mockImportsFetch();
    const user = userEvent.setup();

    renderGuestAddWorkFlow();

    await user.click(screen.getByLabelText('검색으로 채우기'));

    expect(await screen.findByLabelText(/^작품 검색$/)).toBeInTheDocument();
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/검색은 로그인해야만 가능/),
    ).not.toBeInTheDocument();
  });

  it('shows readable provider diagnostics after a candidate search', async () => {
    mockImportsFetch({
      responseOptions: {
        body: {
          provider: 'open_library',
          providers: ['open_library', 'tmdb'],
          query: 'Dune',
          candidates: [],
          diagnostics: {
            providers: [
              {
                provider: 'open_library',
                status: 'searched',
                credentialMode: 'none',
                configured: true,
                resultCount: 0,
                reasonCode: null,
                message: 'Open Library search completed.',
              },
              {
                provider: 'tmdb',
                status: 'skipped',
                credentialMode: 'user',
                configured: false,
                resultCount: 0,
                reasonCode: 'user_credential_missing',
                message: 'TMDB search requires a configured user key.',
              },
            ],
          },
        },
      },
    });
    const user = userEvent.setup();

    renderGuestAddWorkFlow();
    await openSearchPicker(user, 'Dune');

    expect(
      await screen.findByText(/검색 완료: Open Library 0개/),
    ).toBeInTheDocument();
    expect(screen.getByText(/제외됨: TMDB/)).toBeInTheDocument();
  });

  it('renders search as an inline panel instead of a nested modal', async () => {
    mockImportsFetch();
    const user = userEvent.setup();

    renderGuestAddWorkFlow();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('검색으로 채우기'));

    expect(await screen.findByLabelText(/^작품 검색$/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits direct manual adds without catalog or import identity', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow(onSubmit);

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      '직접 쓴 작품',
    );
    await user.selectOptions(
      getElementById<HTMLSelectElement>('manualType'),
      'anime',
    );
    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );

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
    renderGuestAddWorkFlow(onSubmit);

    await user.type(
      getElementById<HTMLInputElement>('manualTitle'),
      '게스트 수동 기록',
    );
    await user.selectOptions(
      getElementById<HTMLSelectElement>('manualType'),
      'movie',
    );
    await user.click(
      screen.getByRole('button', { name: '내 아카이브에 저장' }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      title: '게스트 수동 기록',
      type: 'movie',
      catalogTitleId: null,
      importDraft: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses public no-key provider search for guests', async () => {
    const candidate = buildCandidate({
      sourceId: 'open_library',
      sourceLabel: 'Open Library',
      title: 'Dune',
    });
    const fetchMock = mockImportsFetch({
      candidates: [candidate],
      provider: 'open_library',
    });
    const user = userEvent.setup();

    renderGuestAddWorkFlow();

    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/imports/search?'),
        ),
      ).toBe(true);
    });

    const searchFetchCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/imports/search?'),
    );

    expect(searchFetchCall).toBeDefined();

    const [firstFetchInput, firstFetchInit] = searchFetchCall!;

    expect(String(firstFetchInput)).toContain('/imports/search?');
    expect(
      new URL(String(firstFetchInput), 'http://localhost').searchParams.get(
        'providers',
      ),
    ).toBeNull();
    expect(firstFetchInit).toMatchObject({
      method: 'GET',
    });
    const headers = new Headers(
      (firstFetchInit as RequestInit | undefined)?.headers,
    );

    expect(headers.has('authorization')).toBe(false);
    expect(
      await waitFor(() => getElementById<HTMLInputElement>('manualTitle')),
    ).toHaveValue(candidate.title);
  });

  it('passes selected provider group ids to external search', async () => {
    const candidate = buildCandidate();
    const fetchMock = mockAuthenticatedSearchResponse([candidate]);
    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();

    await user.click(screen.getByLabelText('검색으로 채우기'));
    await user.click(await screen.findByRole('button', { name: '검색 설정' }));
    await user.click(await screen.findByRole('button', { name: '도서' }));

    const searchInput = await screen.findByLabelText(/^작품 검색$/);
    await user.type(searchInput, 'Dune');

    const searchForm = searchInput.closest('form');
    expect(searchForm).not.toBeNull();
    await user.click(
      searchForm!.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/imports/search?'),
        ),
      ).toBe(true);
    });

    const searchFetchCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/imports/search?'),
    );
    const [firstFetchInput] = searchFetchCall!;

    expect(
      new URL(String(firstFetchInput), 'http://localhost').searchParams.get(
        'providers',
      ),
    ).toBe('google_books,open_library,aladin,naver_book,kakao_book');
  });

  it('requests only the manual provider for the direct-add search group', async () => {
    const candidate = buildCandidate({
      sourceId: 'manual',
      sourceLabel: '직접 추가',
    });
    const fetchMock = mockAuthenticatedSearchResponse([candidate]);
    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();

    await user.click(screen.getByLabelText('검색으로 채우기'));
    await selectManualProviderGroup(user);

    const searchInput = await screen.findByLabelText(/^작품 검색$/);
    await user.type(searchInput, 'Dune');

    const searchForm = searchInput.closest('form');
    expect(searchForm).not.toBeNull();
    await user.click(
      searchForm!.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/imports/search?'),
        ),
      ).toBe(true);
    });

    const searchFetchCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/imports/search?'),
    );
    const [firstFetchInput] = searchFetchCall!;

    expect(
      new URL(String(firstFetchInput), 'http://localhost').searchParams.get(
        'providers',
      ),
    ).toBe('manual');
  });

  it('hides manual fallback candidates from automatic search results when external candidates exist', async () => {
    const externalCandidate = buildCandidate({
      sourceId: 'open_library',
      sourceLabel: 'Open Library',
      title: 'One Piece External',
    });
    const manualCandidate = buildCandidate({
      id: 'manual:one-piece:manga',
      sourceId: 'manual',
      sourceLabel: '직접 추가',
      title: 'One Piece (만화)',
    });

    mockImportsFetch({
      candidates: [manualCandidate, externalCandidate],
      provider: 'open_library',
    });
    const user = userEvent.setup();

    renderGuestAddWorkFlow();
    await openSearchPicker(user, 'One Piece');

    expect(
      (await screen.findAllByText('One Piece External')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('One Piece (만화)')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '직접 추가로 계속' }),
    ).toBeInTheDocument();
  });

  it('shows the direct-add CTA instead of manual fallback rows when automatic search only returns manual candidates', async () => {
    const manualCandidate = buildCandidate({
      id: 'manual:no-match:manga',
      sourceId: 'manual',
      sourceLabel: '직접 추가',
      title: 'No Match Title (만화)',
    });

    mockImportsFetch({
      candidates: [manualCandidate],
      provider: 'manual',
    });
    const user = userEvent.setup();

    renderGuestAddWorkFlow();
    await openSearchPicker(user, 'No Match Title');

    expect(await screen.findByRole('button', { name: '직접 추가로 계속' })).toBeInTheDocument();
    expect(screen.queryByText('No Match Title (만화)')).not.toBeInTheDocument();
  });

  it('shows manual fallback candidates only in the direct-add search group without external identity badges', async () => {
    const manualCandidate = buildCandidate({
      id: 'manual:custom-dune:manga',
      sourceId: 'manual',
      sourceCoverage: {
        externalIdentityCount: 1,
        providerCount: 1,
        providers: ['manual'],
        releaseCandidateCount: 0,
      },
      sourceLabel: '직접 추가',
      title: 'Custom Dune (만화)',
    });

    mockAuthenticatedSearchResponse([manualCandidate]);
    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await user.click(screen.getByLabelText('검색으로 채우기'));
    await selectManualProviderGroup(user);

    const searchInput = await screen.findByLabelText(/^작품 검색$/);
    await user.type(searchInput, 'Custom Dune');

    const searchForm = searchInput.closest('form');
    expect(searchForm).not.toBeNull();
    await user.click(
      searchForm!.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );

    expect(
      (await screen.findAllByText('Custom Dune (만화)')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('외부 식별자 1개')).not.toBeInTheDocument();
    expect(screen.queryByText('출처 1개')).not.toBeInTheDocument();
    expect(screen.queryByText('High confidence')).not.toBeInTheDocument();
  });

  it('offers direct manual add when external search returns no candidates', async () => {
    mockImportsFetch({
      candidates: [],
      provider: 'open_library',
    });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderGuestAddWorkFlow(onSubmit);

    await user.click(screen.getByLabelText('검색으로 채우기'));

    const searchInput = await screen.findByLabelText(/^작품 검색$/);

    await user.type(searchInput, 'No Match Title');

    const searchForm = searchInput.closest('form');

    expect(searchForm).not.toBeNull();

    const searchButton = searchForm?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );

    expect(searchButton).not.toBeNull();

    await user.click(searchButton!);

    const manualCta = await screen.findByRole('button', {
      name: '직접 추가로 계속',
    });

    expect(
      screen.queryByText(/로그인해야만 검색 가능/),
    ).not.toBeInTheDocument();

    await user.click(manualCta);

    expect(getElementById<HTMLInputElement>('manualTitle')).toHaveValue(
      'No Match Title',
    );

    await submitSelectedCandidate(user);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      catalogTitleId: null,
      importDraft: null,
      title: 'No Match Title',
    });
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

    renderAuthenticatedAddWorkFlow(onSubmit);
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

    renderAuthenticatedAddWorkFlow(onSubmit);
    await searchAndSelectCandidate(user, 'Dune', candidate.title);

    const titleInput = await waitFor(() =>
      getElementById<HTMLInputElement>('manualTitle'),
    );
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

      renderAuthenticatedAddWorkFlow(onSubmit);
      if (sourceId === 'manual' || sourceId === 'preview-manual') {
        await user.click(screen.getByLabelText('검색으로 채우기'));
        await selectManualProviderGroup(user);
        const searchInput = await screen.findByLabelText(/^작품 검색$/);
        await user.type(searchInput, 'Dune');
        const searchForm = searchInput.closest('form');
        expect(searchForm).not.toBeNull();
        await user.click(
          searchForm!.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
          )!,
        );
        await selectCandidateRow(user, candidate.title);
        await user.click(
          screen.getByRole('button', { name: '직접 추가로 입력 채우기' }),
        );
      } else {
        await searchAndSelectCandidate(user, 'Dune', candidate.title);
      }
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

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Dune');
    await selectCandidateRow(user, candidate.title);

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('a')).some(
          (link) =>
            link.getAttribute('href') === '/works/existing-catalog-match',
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

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Different');
    await selectCandidateRow(user, candidate.title);

    expect(
      await screen.findByText('비슷한 기록이 이미 있습니다'),
    ).toBeInTheDocument();
  });

  it('shows a duplicate warning when a candidate alias matches an existing title', async () => {
    await seedAuthenticatedExistingWork({
      id: 'existing-alias-match',
      title: '나 혼자만 레벨업',
    });
    const candidate = buildCandidate({
      sourceId: 'google_books',
      sourceLabel: 'Google Books',
      title: 'Solo Leveling',
      titleAliases: ['나 혼자만 레벨업'],
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Solo Leveling');
    await selectCandidateRow(user, candidate.title);

    expect(
      await screen.findByText('비슷한 기록이 이미 있습니다'),
    ).toBeInTheDocument();
  });

  it('shows a duplicate warning when release candidate external refs match an existing importDraft', async () => {
    await seedAuthenticatedExistingWork({
      id: 'existing-release-external-match',
      title: 'Stored Release Match',
      importDraft: {
        mediumType: 'novel',
        releaseCandidates: [
          {
            externalRefs: [
              {
                externalId: 'release-1',
                provider: 'google_books',
                rawType: 'volume',
                url: 'https://example.com/google-books/release-1',
              },
            ],
            isbn: '9781234567890',
          },
        ],
      },
    });
    const candidate = buildCandidate({
      externalRefs: [],
      releaseCandidates: [
        {
          displayLabel: 'Volume 1',
          externalRefs: [
            {
              externalId: 'release-1',
              provider: 'google_books',
              rawType: 'volume',
              url: 'https://example.com/google-books/release-1',
            },
          ],
          isbn: '9781234567890',
          releaseType: 'volume',
          title: 'Dune Volume 1',
        },
      ],
      title: 'Different Release Title',
    });

    mockAuthenticatedSearchResponse([candidate]);

    const user = userEvent.setup();

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Different Release');
    await selectCandidateRow(user, candidate.title);

    expect(
      await screen.findByText('비슷한 기록이 이미 있습니다'),
    ).toBeInTheDocument();
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

      renderAuthenticatedAddWorkFlow();
      if (sourceId === 'manual' || sourceId === 'preview-manual') {
        await user.click(screen.getByLabelText('검색으로 채우기'));
        await selectManualProviderGroup(user);
        const searchInput = await screen.findByLabelText(/^작품 검색$/);
        await user.type(searchInput, 'Dune');
        const searchForm = searchInput.closest('form');
        expect(searchForm).not.toBeNull();
        await user.click(
          searchForm!.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
          )!,
        );
      } else {
        await openSearchPicker(user, 'Dune');
      }
      await selectCandidateRow(user, candidate.title);

      expect(
        await screen.findByText('비슷한 기록이 이미 있습니다'),
      ).toBeInTheDocument();
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

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Dune');
    await selectCandidateRow(user, candidate.title);

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll('a')).some(
          (link) =>
            link.getAttribute('href') === '/works?scope=trash&q=Dune%20Deleted',
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

    renderAuthenticatedAddWorkFlow();
    await openSearchPicker(user, 'Dune');
    await user.click(
      await screen.findByRole('button', { name: '직접 추가로 계속' }),
    );

    expect(
      await waitFor(() => getElementById<HTMLInputElement>('manualTitle')),
    ).toHaveValue('Dune');
  });
});
