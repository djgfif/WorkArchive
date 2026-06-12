import { screen } from '@testing-library/react';
import type { WorkRecord } from '@work-archive/shared-types';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { AuthContext } from '@features/auth';
import { clearStoredAuthTokens, writeStoredAuthTokens } from '@features/auth';
import { resetWorkArchiveStorage, workArchiveDbManager } from '@features/works';
import { LAST_JSON_EXPORT_AT_META_KEY } from '@features/archive';
import { SettingsPage } from './SettingsPage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function noContentResponse() {
  return new Response(null, {
    status: 204,
  });
}

function authSessionsResponse() {
  return {
    sessions: [
      {
        id: 'session-1',
        current: true,
        rememberMe: true,
        userAgent: 'Vitest Browser',
        ipAddress: '127.0.0.1',
        createdAt: '2026-05-12T00:00:00.000Z',
        lastUsedAt: '2026-05-12T00:00:00.000Z',
        rotatedAt: null,
        expiresAt: '2026-06-11T00:00:00.000Z',
      },
    ],
  };
}

function notionStatusResponse() {
  return {
    configured: false,
    dataSourceId: null,
    lastSyncedAt: null,
    mappedCount: 0,
    requiredProperties: [],
  };
}

function buildWorkRecord(
  id: string,
  overrides: Partial<WorkRecord> = {},
): WorkRecord {
  const now = '2026-05-20T00:00:00.000Z';

  return {
    id,
    type: 'novel',
    title: id,
    author: '',
    genres: [],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'planned',
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

async function seedOverviewStats() {
  const db = workArchiveDbManager.getCurrentDb();
  const now = '2026-05-20T00:00:00.000Z';

  await db.works.bulkAdd([
    buildWorkRecord('work-active-1'),
    buildWorkRecord('work-active-2'),
    buildWorkRecord('work-deleted-1', {
      deletedAt: now,
    }),
  ]);
  await db.timelineEntries.add({
    id: 'timeline-entry-1',
    workId: 'work-active-1',
    type: 'note',
    occurredAt: now,
    note: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  });
  await db.releaseRecords.add({
    id: 'release-record-1',
    userWorkRecordId: 'work-active-1',
    catalogReleaseId: 'catalog-release-1',
    status: 'completed',
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  });
  await db.syncQueue.bulkAdd([
    {
      id: 'queue-1',
      entityType: 'work',
      entityId: 'work-active-1',
      operation: 'update',
      payload: buildWorkRecord('work-active-1'),
      source: 'edit_form',
      createdAt: now,
      retryCount: 0,
      lastError: null,
      conflict: null,
    },
    {
      id: 'queue-2',
      entityType: 'work',
      entityId: 'work-active-2',
      operation: 'update',
      payload: buildWorkRecord('work-active-2'),
      source: 'edit_form',
      createdAt: now,
      retryCount: 1,
      lastError: 'network failed',
      conflict: null,
    },
    {
      id: 'queue-3',
      entityType: 'work',
      entityId: 'work-deleted-1',
      operation: 'update',
      payload: buildWorkRecord('work-deleted-1'),
      source: 'edit_form',
      createdAt: now,
      retryCount: 1,
      lastError: 'conflict',
      conflict: {
        detectedAt: now,
        message: 'conflict',
        remote: null,
      },
    },
  ]);
  await db.appMeta.put({
    key: LAST_JSON_EXPORT_AT_META_KEY,
    value: '2026-05-20T12:30:00.000Z',
  });
}

async function seedActiveWorks(count: number) {
  const db = workArchiveDbManager.getCurrentDb();

  await db.works.bulkAdd(
    Array.from({ length: count }, (_, index) =>
      buildWorkRecord(`backup-reminder-work-${index + 1}`),
    ),
  );
}

function renderAuthenticatedSettings(signOut = vi.fn()) {
  workArchiveDbManager.switchToUser('user-1');
  const updateUser = vi.fn();
  const view = renderWithProviders(
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
            handle: 'frieren',
            nickname: 'Frieren',
          },
          signOut,
          updateUser,
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return {
    ...view,
    signOut,
    updateUser,
  };
}

function renderGuestSettings() {
  workArchiveDbManager.switchToGuest();

  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: 'guest',
          isLoading: false,
          mode: 'guest',
          user: null,
          signOut: vi.fn(),
          updateUser: vi.fn(),
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function openSettingsSection(
  user: ReturnType<typeof userEvent.setup>,
  sectionId: string,
) {
  const sectionTab = document.querySelector(`[data-section-id="${sectionId}"]`);

  if (!(sectionTab instanceof HTMLElement)) {
    throw new Error(`Settings section tab not found: ${sectionId}`);
  }

  await user.click(sectionTab);
}

describe('SettingsPage', () => {
  afterEach(async () => {
    clearStoredAuthTokens();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await resetWorkArchiveStorage();
  });

  it('renders provider readiness cards for public and user-key credential modes', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const providerStatuses = [
      {
        provider: 'manual',
        label: 'Manual',
        credentialMode: 'none',
        configured: true,
        mediumTypes: ['novel', 'anime'],
      },
      {
        provider: 'wikidata',
        label: 'Wikidata',
        credentialMode: 'none',
        configured: true,
        mediumTypes: ['novel', 'anime', 'movie', 'drama'],
      },
      {
        provider: 'aladin',
        label: 'Aladin Book',
        credentialMode: 'user',
        configured: false,
        credentialFields: [{ name: 'ttbKey', label: 'TTBKey', secret: true }],
        mediumTypes: ['novel', 'light_novel', 'manga'],
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
        provider: 'brave_search',
        label: 'Brave Search',
        credentialMode: 'user',
        configured: false,
        credentialFields: [{ name: 'apiKey', label: 'API Key', secret: true }],
        mediumTypes: ['web_novel', 'webtoon', 'anime'],
      },
      {
        provider: 'tavily_search',
        label: 'Tavily Search',
        credentialMode: 'user',
        configured: false,
        credentialFields: [{ name: 'apiKey', label: 'API Key', secret: true }],
        mediumTypes: ['web_novel', 'webtoon'],
      },
    ];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      if (requestUrl.includes('/notion/status')) {
        return Promise.resolve(jsonResponse(notionStatusResponse()));
      }

      return Promise.resolve(jsonResponse(providerStatuses));
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'search-providers');

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('Wikidata').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/공개 Wikidata\/Wikimedia 정보/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Aladin Book').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TMDB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brave Search').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tavily Search').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /사용자 개인 Brave Search API key가 필요합니다\. 서버 운영자 키를 사용하지 않습니다\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /사용자 개인 Tavily API key가 필요합니다\. 서버 운영자 키를 사용하지 않습니다\./,
      ),
    ).toBeInTheDocument();
    const providerKeyInput = screen.getByLabelText('TTBKey');

    expect(providerKeyInput).toHaveAttribute('type', 'text');
    expect(providerKeyInput).toHaveAttribute('autocomplete', 'off');
    expect(providerKeyInput).toHaveAttribute(
      'name',
      'provider-credential-aladin-ttbKey',
    );
    expect(providerKeyInput).toHaveAttribute('data-lpignore', 'true');
    expect(providerKeyInput).toHaveAttribute('data-1p-ignore', 'true');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/imports/providers'),
        expect.stringContaining('/notion/status'),
        expect.stringContaining('/auth/sessions'),
      ]),
    );
    await openSettingsSection(user, 'security');
    expect(
      await screen.findByRole('button', { name: '이 기기 로그아웃' }),
    ).toBeInTheDocument();
  });

  it('renders local-first overview stats from Dexie without waiting for backend data', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    workArchiveDbManager.switchToUser('user-1');
    await seedOverviewStats();

    vi.stubGlobal('fetch', fetchMock);

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'overview');

    expect(await screen.findByText('2개 작품')).toBeInTheDocument();
    expect(
      screen.getByText(
        '활성 작품 2개 · 휴지통 1개 · 타임라인 1개 · 릴리스 기록 1개',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('백업 대기 3개')).toBeInTheDocument();
    expect(
      screen.getByText(
        '전체 3개 · 직접 확인 1개 · 실패 1개 · 자동 병합 후 재시도 0개 · 로컬 전용 작품 3개',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('스토리지 진단')).toBeInTheDocument();
    expect(screen.getByText('백업 전 작품 있음')).toBeInTheDocument();
    expect(screen.getAllByText('work-archive-db-user-user-1')).toHaveLength(2);
    expect(screen.getByText('3개')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('marks guest overview as local-only with no JSON export history', async () => {
    const user = userEvent.setup();

    renderGuestSettings();
    await openSettingsSection(user, 'overview');

    expect(await screen.findAllByText('로컬 전용')).toHaveLength(2);
    expect(screen.getByText('아직 없음')).toBeInTheDocument();
    expect(
      screen.getByText(
        '게스트 모드입니다. 기록은 이 브라우저의 로컬 저장소에만 보관됩니다.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the shared JSON backup reminder in settings overview', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([]))),
    );
    workArchiveDbManager.switchToUser('user-1');
    await seedActiveWorks(20);

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'overview');

    expect(
      await screen.findByText('첫 JSON 백업을 권장합니다'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
  });

  it('saves account profile changes and updates the auth user', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const updatedUser = {
      avatarUrl: 'https://example.com/avatar.jpg',
      id: 'user-1',
      email: 'frieren@example.com',
      handle: 'mage_frieren',
      nickname: 'Mage Frieren',
      role: 'user',
      authAccounts: [],
    };
    const fetchMock = vi.fn(
      (url: string | URL | Request, _init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/auth/profile')) {
          return Promise.resolve(jsonResponse(updatedUser));
        }

        if (requestUrl.includes('/auth/sessions')) {
          return Promise.resolve(jsonResponse(authSessionsResponse()));
        }

        return Promise.resolve(jsonResponse([]));
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const { updateUser } = renderAuthenticatedSettings();

    await openSettingsSection(user, 'account');

    const saveButton = screen.getByRole('button', {
      name: '프로필 변경 저장',
    });

    expect(saveButton).toBeDisabled();

    await user.clear(screen.getByLabelText('표시 이름'));
    await user.type(screen.getByLabelText('표시 이름'), 'Mage Frieren');
    await user.type(
      screen.getByLabelText('프로필 사진 URL'),
      'https://example.com/avatar.jpg',
    );
    await user.clear(screen.getByLabelText('handle'));
    await user.type(screen.getByLabelText('handle'), '@mage_frieren');
    await user.click(saveButton);

    expect(
      await screen.findByText('프로필 변경 사항을 저장했습니다.'),
    ).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith(updatedUser);

    const profileRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/auth/profile'),
    );
    const profileRequestInit = profileRequest?.[1] as RequestInit;
    const profileRequestHeaders = profileRequestInit.headers as Headers;

    expect(profileRequest?.[0]).toEqual(
      expect.stringContaining('/auth/profile'),
    );
    expect(profileRequestInit.method).toBe('PATCH');
    expect(profileRequestInit.body).toBe(
      JSON.stringify({
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: 'mage_frieren',
        nickname: 'Mage Frieren',
      }),
    );
    expect(profileRequestHeaders.get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  it('shows Korean profile validation and duplicate handle messages', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn(
      (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/auth/profile') && init?.method === 'PATCH') {
          return Promise.resolve(
            jsonResponse(
              {
                message: 'Handle is already in use.',
              },
              409,
            ),
          );
        }

        if (requestUrl.includes('/auth/sessions')) {
          return Promise.resolve(jsonResponse(authSessionsResponse()));
        }

        return Promise.resolve(jsonResponse([]));
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'account');

    await user.clear(screen.getByLabelText('handle'));
    await user.type(screen.getByLabelText('handle'), '_bad');
    await user.click(screen.getByRole('button', { name: '프로필 변경 저장' }));

    expect(
      (await screen.findAllByText(/앞뒤 밑줄은 사용할 수 없습니다/)).length,
    ).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/auth/profile'),
      ),
    ).toBe(false);

    await user.clear(screen.getByLabelText('handle'));
    await user.type(screen.getByLabelText('handle'), 'fern');
    await user.click(screen.getByRole('button', { name: '프로필 변경 저장' }));

    expect(
      await screen.findByText('이미 사용 중인 handle입니다.'),
    ).toBeInTheDocument();
  });

  it('tests configured provider keys and reports success or failure feedback', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const providerStatuses = [
      {
        provider: 'aladin',
        label: 'Aladin Book',
        credentialMode: 'user',
        configured: false,
        credentialFields: [{ name: 'ttbKey', label: 'TTBKey', secret: true }],
        mediumTypes: ['novel', 'light_novel', 'manga'],
      },
      {
        provider: 'tmdb',
        label: 'TMDB',
        credentialMode: 'user',
        configured: true,
        credentialFields: [
          { name: 'readToken', label: 'Read Access Token', secret: true },
        ],
        mediumTypes: ['movie', 'drama'],
      },
      {
        provider: 'kobis',
        label: 'KOBIS',
        credentialMode: 'user',
        configured: true,
        credentialFields: [{ name: 'apiKey', label: 'API Key', secret: true }],
        mediumTypes: ['movie'],
      },
    ];
    const fetchMock = vi.fn(
      (url: string | URL | Request, _init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/auth/sessions')) {
          return Promise.resolve(jsonResponse(authSessionsResponse()));
        }

        if (requestUrl.includes('/imports/providers/tmdb/test')) {
          return Promise.resolve(
            jsonResponse({
              provider: 'tmdb',
              ok: true,
              message: 'TMDB API key connection test succeeded.',
              reason: null,
              checkedAt: '2026-05-20T00:00:00.000Z',
            }),
          );
        }

        if (requestUrl.includes('/imports/providers/kobis/test')) {
          return Promise.resolve(
            jsonResponse({
              provider: 'kobis',
              ok: false,
              message: 'KOBIS API key was rejected by the provider.',
              reason: 'unauthorized',
              checkedAt: '2026-05-20T00:00:00.000Z',
            }),
          );
        }

        if (requestUrl.includes('/imports/providers')) {
          return Promise.resolve(jsonResponse(providerStatuses));
        }

        return Promise.resolve(jsonResponse([]));
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'search-providers');

    const testButton = await screen.findByRole('button', {
      name: '연결 테스트',
    });

    expect(testButton).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: /TMDB/ }));
    expect(screen.getByRole('button', { name: '연결 테스트' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '연결 테스트' }));

    expect(
      await screen.findByText('TMDB 연결 테스트에 성공했습니다.'),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /KOBIS/ }));
    await user.click(screen.getByRole('button', { name: '연결 테스트' }));

    expect(
      await screen.findByText(
        'KOBIS에서 API 키를 거부했습니다. 키 값을 다시 확인해 주세요.',
      ),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining('/imports/providers/tmdb/test'),
          expect.objectContaining({
            method: 'POST',
          }),
        ]),
        expect.arrayContaining([
          expect.stringContaining('/imports/providers/kobis/test'),
          expect.objectContaining({
            method: 'POST',
          }),
        ]),
      ]),
    );
  });

  it.each([
    {
      provider: 'aladin',
      label: 'Aladin Book',
      fields: [{ name: 'ttbKey', label: 'TTBKey', value: 'ttb-test-key' }],
    },
    {
      provider: 'tmdb',
      label: 'TMDB',
      fields: [
        {
          name: 'readToken',
          label: 'Read Access Token',
          value: 'tmdb-read-token',
        },
      ],
    },
    {
      provider: 'naver_book',
      label: 'Naver Book',
      fields: [
        { name: 'clientId', label: 'Client ID', value: 'naver-client-id' },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          value: 'naver-client-secret',
        },
      ],
    },
    {
      provider: 'kakao_book',
      label: 'Kakao Book',
      fields: [
        { name: 'restApiKey', label: 'REST API Key', value: 'kakao-rest-key' },
      ],
    },
    {
      provider: 'kobis',
      label: 'KOBIS',
      fields: [{ name: 'apiKey', label: 'API Key', value: 'kobis-api-key' }],
    },
    {
      provider: 'brave_search',
      label: 'Brave Search',
      fields: [{ name: 'apiKey', label: 'API Key', value: 'brave-user-key' }],
    },
    {
      provider: 'tavily_search',
      label: 'Tavily Search',
      fields: [{ name: 'apiKey', label: 'API Key', value: 'tavily-user-key' }],
    },
  ])(
    'saves and deletes the authenticated user $label key without showing it again',
    async ({ fields, label, provider }) => {
      writeStoredAuthTokens({
        accessToken: 'access-token',
      });
      const providerStatuses = [
        {
          provider: 'manual',
          label: 'Manual',
          credentialMode: 'none',
          configured: true,
          mediumTypes: ['novel', 'anime'],
        },
        {
          provider: 'aladin',
          label: 'Aladin Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [{ name: 'ttbKey', label: 'TTBKey', secret: true }],
          mediumTypes: ['novel', 'light_novel', 'manga'],
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
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'kakao_book',
          label: 'Kakao Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'restApiKey', label: 'REST API Key', secret: true },
          ],
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'kobis',
          label: 'KOBIS',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'apiKey', label: 'API Key', secret: true },
          ],
          mediumTypes: ['movie'],
        },
        {
          provider: 'brave_search',
          label: 'Brave Search',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'apiKey', label: 'API Key', secret: true },
          ],
          mediumTypes: ['web_novel', 'webtoon', 'anime'],
        },
        {
          provider: 'tavily_search',
          label: 'Tavily Search',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'apiKey', label: 'API Key', secret: true },
          ],
          mediumTypes: ['web_novel', 'webtoon'],
        },
      ];
      const fetchMock = vi.fn(
        (url: string | URL | Request, init?: RequestInit) => {
          const requestUrl = String(url);

          if (requestUrl.includes('/auth/sessions')) {
            return Promise.resolve(jsonResponse(authSessionsResponse()));
          }

          if (requestUrl.includes(`/imports/providers/${provider}/key`)) {
            if (init?.method === 'PUT') {
              return Promise.resolve(
                jsonResponse({
                  provider,
                  configured: true,
                }),
              );
            }

            if (init?.method === 'DELETE') {
              return Promise.resolve(noContentResponse());
            }
          }

          return Promise.resolve(jsonResponse(providerStatuses));
        },
      );

      vi.stubGlobal('fetch', fetchMock);

      const user = userEvent.setup();

      renderAuthenticatedSettings();
      await openSettingsSection(user, 'search-providers');

      expect(
        await screen.findByText('검색 소스 관리'),
      ).toBeInTheDocument();
      if (provider !== 'aladin') {
        await user.click(
          await screen.findByRole('button', {
            name: new RegExp(label),
          }),
        );
      }

      for (const field of fields) {
        await user.type(await screen.findByLabelText(field.label), field.value);
      }
      await user.click(screen.getByRole('button', { name: /키 저장/ }));

      expect(
        await screen.findByText(/API key를 저장했습니다/),
      ).toBeInTheDocument();
      for (const field of fields) {
        expect(screen.getByLabelText(field.label)).toHaveValue('');
      }
      const providerRequest = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/imports/providers'),
      );
      const saveRequest = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/imports/providers/${provider}/key`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      const saveRequestInit = saveRequest?.[1] as RequestInit;
      const saveRequestHeaders = saveRequestInit.headers as Headers;
      const expectedValues = Object.fromEntries(
        fields.map((field) => [field.name, field.value]),
      );

      expect(providerRequest?.[0]).toEqual(
        expect.stringContaining('/imports/providers'),
      );
      expect(saveRequest?.[0]).toEqual(
        expect.stringContaining(`/imports/providers/${provider}/key`),
      );
      expect(saveRequestInit.method).toBe('PUT');
      expect(saveRequestInit.body).toBe(
        JSON.stringify({ values: expectedValues }),
      );
      expect(saveRequestHeaders.get('authorization')).toBe(
        'Bearer access-token',
      );

      await user.click(screen.getByRole('button', { name: /키 삭제/ }));

      expect(
        await screen.findByText(/API key를 삭제했습니다/),
      ).toBeInTheDocument();
      const deleteRequest = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/imports/providers/${provider}/key`) &&
          (init as RequestInit | undefined)?.method === 'DELETE',
      );
      expect(deleteRequest?.[0]).toEqual(
        expect.stringContaining(`/imports/providers/${provider}/key`),
      );
      expect((deleteRequest?.[1] as RequestInit).method).toBe('DELETE');
    },
  );

  it('revokes the current session and signs out locally', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn(
      (url: string | URL | Request, _init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/auth/sessions/session-1')) {
          return Promise.resolve(noContentResponse());
        }

        if (requestUrl.includes('/auth/sessions')) {
          return Promise.resolve(jsonResponse(authSessionsResponse()));
        }

        return Promise.resolve(jsonResponse([]));
      },
    );
    const signOut = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'security');

    expect(
      await screen.findByRole('button', { name: '이 기기 로그아웃' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '이 기기 로그아웃',
      }),
    );

    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining('/auth/sessions/session-1'),
          expect.objectContaining({
            method: 'DELETE',
          }),
        ]),
      ]),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('revokes every session and signs out locally', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions/revoke-all')) {
        return Promise.resolve(noContentResponse());
      }

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse([]));
    });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const confirmMock = vi.fn(() => true);

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirmMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'danger-zone');

    expect(
      await screen.findByRole('button', { name: '모든 기기 로그아웃' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '모든 기기 로그아웃',
      }),
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(
      [
        '모든 기기에서 로그아웃할까요?',
        '현재 기기를 포함한 모든 로그인 세션이 해제되고, 이 브라우저는 게스트 모드로 전환됩니다.',
      ].join('\n'),
    );
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining('/auth/sessions/revoke-all'),
          expect.objectContaining({
            method: 'POST',
          }),
        ]),
      ]),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps every session when revoke all confirmation is cancelled', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions/revoke-all')) {
        return Promise.resolve(noContentResponse());
      }

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse([]));
    });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const confirmMock = vi.fn(() => false);

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirmMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'danger-zone');

    await user.click(
      await screen.findByRole('button', {
        name: '모든 기기 로그아웃',
      }),
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/auth/sessions/revoke-all'),
      ),
    ).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('shows login guidance instead of provider readiness for guests', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderGuestSettings();
    await openSettingsSection(user, 'data-backup');

    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CSV 내보내기' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('JSON 백업 파일 선택')).toBeInTheDocument();
    expect(screen.queryByLabelText('TTBKey')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
