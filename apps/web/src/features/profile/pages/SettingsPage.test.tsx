import { screen, waitFor, within } from '@testing-library/react';
import type { WorkRecord } from '@work-archive/shared-types';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { AuthContext } from '@features/auth';
import { clearStoredAuthTokens, writeStoredAuthTokens } from '@features/auth';
import { resetWorkArchiveStorage, workArchiveDbManager } from '@features/works';
import {
  LAST_JSON_BACKUP_SUMMARY_META_KEY,
  LAST_JSON_EXPORT_AT_META_KEY,
  resetAutomaticJsonBackupSessionForTest,
} from '@features/archive';
import { syncService } from '@features/sync';
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
      clientMutationId: 'mutation-queue-1',
      nextRetryAt: null,
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
      clientMutationId: 'mutation-queue-2',
      nextRetryAt: null,
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
      clientMutationId: 'mutation-queue-3',
      nextRetryAt: null,
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
  await db.appMeta.put({
    key: LAST_JSON_BACKUP_SUMMARY_META_KEY,
    value: JSON.stringify({
      byteLength: 2048,
      contentVerifiedAt: '2026-05-20T12:30:00.000Z',
      exportedAt: '2026-05-20T12:30:00.000Z',
      fileName: 'work-archive-full-backup-2026-05-20.json',
      fileVerifiedAt: '2026-05-20T12:31:00.000Z',
      recordCounts: {
        appMetaCount: 1,
        contributorCount: 0,
        releaseRecordCount: 1,
        seriesCount: 0,
        tierBoardAssetCount: 0,
        tierBoardCardCount: 0,
        tierBoardCount: 0,
        tierLaneCount: 0,
        timelineEntryCount: 1,
        workContributorCount: 0,
        workCount: 2,
        workRelationCount: 0,
        workSeriesLinkCount: 0,
      },
      scope: 'full',
      sha256:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    }),
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
          sessionStatus: 'authenticated',
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
          sessionStatus: 'guest',
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
    resetAutomaticJsonBackupSessionForTest();
    delete (window as typeof window & { showDirectoryPicker?: unknown })
      .showDirectoryPicker;
    await resetWorkArchiveStorage();
  });

  it('shows reviewed locale options in settings', async () => {
    const user = userEvent.setup();

    renderGuestSettings();
    await openSettingsSection(user, 'language');

    expect(screen.getByText('언어 설정')).toBeInTheDocument();
    expect(
      screen.getByText(
        '앱 UI 언어를 선택합니다. 한국어, 영어, 일본어, 중국어 간체 UI를 사용할 수 있습니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('현재 언어')).toBeInTheDocument();
    expect(
      screen.getByText(
        '한국어, 영어, 일본어, 중국어 간체 UI를 사용할 수 있습니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('한국어')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('日本語 · 베타')).toBeInTheDocument();
    expect(screen.getByText('简体中文 · 베타')).toBeInTheDocument();
    expect(screen.queryByText('한국어만 사용 가능')).not.toBeInTheDocument();
    expect(screen.queryByText(/아직 다듬는 중/)).not.toBeInTheDocument();
    expect(screen.queryByText(/순차적으로 열립니다/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/검수 완료된 한국어 UI만/),
    ).not.toBeInTheDocument();
  });

  it('keeps primary settings visible and progressively reveals advanced tools', async () => {
    const user = userEvent.setup();
    renderGuestSettings();

    const primaryNav = screen.getByRole('navigation', {
      name: '주요 설정 탐색',
    });

    expect(
      within(primaryNav)
        .getAllByRole('link')
        .filter((link) => !link.closest('details'))
        .map((link) => link.textContent),
    ).toEqual(['데이터와 백업', '계정', '외부 기록 가져오기', '표시 설정']);

    expect(screen.getByText('고급 설정 및 진단')).toBeInTheDocument();
    expect(
      within(primaryNav).getByRole('link', { hidden: true, name: '보안' }),
    ).not.toBeVisible();

    await user.click(screen.getByText('고급 설정 및 진단'));

    expect(
      within(primaryNav).getByRole('link', { name: '보안' }),
    ).toBeVisible();
    expect(
      within(primaryNav).getByRole('link', { name: 'Notion 동기화' }),
    ).toBeVisible();
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
        provider: 'open_library',
        label: 'Open Library',
        credentialMode: 'none',
        configured: true,
        circuitOpenedUntil: '2026-05-21T01:00:00.000Z',
        circuitReasonCode: 'provider_failed',
        circuitState: 'open',
        mediumTypes: ['novel', 'light_novel'],
      },
      {
        provider: 'naver_book',
        label: 'Naver Book',
        credentialMode: 'server',
        configured: false,
        mediumTypes: ['novel', 'light_novel', 'manga'],
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
    expect(screen.getAllByText('Open Library').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Naver Book').length).toBeGreaterThan(0);
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
    expect(screen.getByText('현재 검색 준비 상태')).toBeInTheDocument();
    expect(screen.getByText('확인 필요')).toBeInTheDocument();
    expect(screen.getAllByText('검색 가능').length).toBeGreaterThan(0);
    expect(screen.getByText(/Manual, Wikidata/)).toBeInTheDocument();
    expect(
      screen.getByText(/Aladin Book, TMDB, Brave Search, Tavily Search/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Naver Book/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Open Library/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        '서버 환경 변수나 운영자 키가 준비되면 사용할 수 있습니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '반복 실패 보호 회로가 열려 있어 잠시 검색에서 제외됩니다.',
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
    expect(screen.getByText('백업 대기 중인 기록 3개')).toBeInTheDocument();
    expect(
      screen.getByText(
        '전체 3개 · 직접 확인 1개 · 실패 1개 · 자동 병합 후 재시도 0개 · 로컬 전용 작품 3개',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('스토리지 진단')).toBeInTheDocument();
    expect(screen.getByText('백업 전 작품 있음')).toBeInTheDocument();
    expect(screen.getAllByText('work-archive-db-user-user-1')).toHaveLength(2);
    expect(screen.getByText('3개 작품')).toBeInTheDocument();
    expect(screen.getByText(/전체 JSON · 작품 2개/)).toBeInTheDocument();
    expect(screen.getByText(/파일 검증됨/)).toBeInTheDocument();
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

  it('summarizes guest data safety without requiring account backup', async () => {
    const user = userEvent.setup();

    renderGuestSettings();
    await openSettingsSection(user, 'data-backup');

    expect(await screen.findByText('백업 준비됨')).toBeInTheDocument();
    expect(screen.getByText('로컬 기록')).toBeInTheDocument();
    expect(screen.getByText('마지막 JSON 백업')).toBeInTheDocument();
    expect(screen.getByText('자동 폴더 백업')).toBeInTheDocument();
    expect(screen.getAllByText('수동 백업 필요').length).toBeGreaterThan(0);
    expect(screen.getAllByText('계정 백업 선택 사항').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: 'Google 계정 연결' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('JSON 백업 파일 선택')).toBeInTheDocument();
  });

  it('summarizes authenticated backup conflicts and manual actions in data safety', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    workArchiveDbManager.switchToUser('user-1');
    await seedOverviewStats();
    const db = workArchiveDbManager.getCurrentDb();
    const now = '2026-05-20T00:00:00.000Z';
    const conflictWork = buildWorkRecord('work-conflict-active', {
      title: '충돌 작품',
      syncStatus: 'conflict',
    });
    const remoteConflictWork = buildWorkRecord('work-conflict-active', {
      title: '계정 백업 작품',
      serverVersion: 2,
      syncStatus: 'synced',
    });

    vi.stubGlobal('fetch', fetchMock);

    renderAuthenticatedSettings();
    await db.works.add(conflictWork);
    await db.syncQueue.add({
      id: 'queue-active-conflict',
      entityType: 'work',
      entityId: conflictWork.id,
      operation: 'update',
      payload: conflictWork,
      source: 'edit_form',
      createdAt: now,
      clientMutationId: 'mutation-active-conflict',
      nextRetryAt: null,
      retryCount: 1,
      lastError: 'conflict',
      conflict: {
        detectedAt: now,
        message: 'manual conflict',
        remote: remoteConflictWork,
      },
    });
    await openSettingsSection(user, 'data-backup');

    expect((await screen.findAllByText('확인 필요')).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText('동기화 충돌 확인')).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText('확인 필요 3개')).toBeInTheDocument();
    expect(await screen.findByText('동기화 충돌 2개')).toBeInTheDocument();
    expect(await screen.findByText('백업 실패 1개')).toBeInTheDocument();
    expect(
      await screen.findByText('동기화 복구가 필요한 항목'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('수동 충돌 검토').length).toBeGreaterThan(0);
    expect(screen.getAllByText('네트워크 재시도').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        '각 항목에서 내 기록 유지, 계정 백업 적용, 선택 병합 중 하나를 고르세요.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '네트워크가 안정된 뒤 다시 열거나 다음 자동 재시도를 기다리세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체 원인' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '네트워크 재시도' }));
    expect(
      screen.getByRole('button', { name: '네트워크 재시도' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('선택한 원인에 해당하는 항목')).toBeInTheDocument();
    expect(screen.getAllByText('수정 · 재시도 1회').length).toBeGreaterThan(0);
    expect(screen.getAllByText('백업 대기').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: '내 기록 유지' }).length,
    ).toBeGreaterThan(0);
    const remoteApplyButtons = screen.getAllByRole('button', {
      name: '계정 백업 기록 적용',
    });
    expect(
      remoteApplyButtons.some((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    expect(
      remoteApplyButtons.some((button) => !button.hasAttribute('disabled')),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('button', { name: '선택 병합' })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    expect(screen.queryByText('network failed')).not.toBeInTheDocument();
  });

  it('does not expose raw sync conflict resolver errors in data safety feedback', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    workArchiveDbManager.switchToUser('user-1');
    await seedOverviewStats();
    const db = workArchiveDbManager.getCurrentDb();
    const now = '2026-05-20T00:00:00.000Z';
    const conflictWork = buildWorkRecord('work-conflict-redacted', {
      title: '민감 오류 테스트 작품',
      syncStatus: 'conflict',
    });
    const rawError =
      'postgres://work:secret@example.test raw access_token cookie payload';

    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(syncService, 'resolveConflictWithLocal').mockRejectedValueOnce(
      new Error(rawError),
    );

    renderAuthenticatedSettings();
    await db.works.add(conflictWork);
    await db.syncQueue.add({
      id: 'queue-redacted-conflict',
      entityType: 'work',
      entityId: conflictWork.id,
      operation: 'update',
      payload: conflictWork,
      source: 'edit_form',
      createdAt: now,
      clientMutationId: 'mutation-redacted-conflict',
      nextRetryAt: null,
      retryCount: 1,
      lastError: 'conflict',
      conflict: {
        detectedAt: now,
        message: 'manual conflict',
        remote: buildWorkRecord('work-conflict-redacted', {
          title: '계정 백업 민감 오류 테스트 작품',
          serverVersion: 2,
          syncStatus: 'synced',
        }),
      },
    });
    await openSettingsSection(user, 'data-backup');

    await user.click(
      (await screen.findAllByRole('button', { name: '내 기록 유지' })).at(-1)!,
    );

    expect(
      await screen.findByText('충돌을 해결하지 못했습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(rawError)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/access_token|cookie|postgres:\/\//),
    ).not.toBeInTheDocument();
  });
  it('shows storage protection and app-open automatic backup controls', async () => {
    const user = userEvent.setup();
    let storagePersisted = false;
    const persist = vi.fn(async () => {
      storagePersisted = true;
      return true;
    });
    const persisted = vi.fn(async () => storagePersisted);
    const write = vi.fn(async (_value: string) => undefined);
    const close = vi.fn(async () => undefined);
    const getFileHandle = vi.fn(async () => ({
      createWritable: vi.fn(async () => ({
        close,
        write,
      })),
    }));

    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => ({
          quota: 2_000_000,
          usage: 500_000,
        })),
        persist,
        persisted,
      },
    });
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(async () => ({
        getFileHandle,
        queryPermission: vi.fn(async () => 'granted'),
        requestPermission: vi.fn(async () => 'granted'),
      })),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([]))),
    );

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'data-backup');

    expect(document.getElementById('data-backup')).toBeInTheDocument();
    expect(
      await screen.findByText('저장소 보호와 자동 폴더 백업'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '저장소 보호 다시 요청' }),
      ).toBeEnabled();
    });
    expect(screen.getAllByText('꺼짐').length).toBeGreaterThan(0);
    expect(screen.getByText('아직 선택되지 않음')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '저장소 보호 다시 요청' }),
    );

    expect(persist).toHaveBeenCalled();
    expect(
      await screen.findByText(
        '이 브라우저에서 로컬 저장소 보호를 확보했습니다.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '자동 백업 폴더 선택' }),
    );

    expect(
      await screen.findByText(
        '자동 백업 폴더를 연결하고 전체 JSON 백업을 만들었습니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('허용됨')).toBeInTheDocument();
    expect(screen.getByText('이번 세션 연결됨')).toBeInTheDocument();
    expect(getFileHandle).toHaveBeenCalledWith(
      expect.stringMatching(
        /^work-archive-full-backup-\d{4}-\d{2}-\d{2}\.json$/,
      ),
      { create: true },
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"scope": "full"'),
    );
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

      expect(await screen.findByText('검색 소스 관리')).toBeInTheDocument();
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

    const backupFile = new File(
      [
        JSON.stringify({
          appMeta: [],
          backupExclusions: [
            'syncQueue',
            'authTokens',
            'refreshCookie',
            'providerApiKeys',
          ],
          contributors: [],
          exportedAt: '2026-05-21T12:30:00.000Z',
          format: 'work-archive.local-archive',
          releaseRecords: [],
          schemaVersion: 2,
          scope: 'full',
          series: [],
          source: 'work-archive-web',
          tierBoardAssets: [],
          tierBoardCards: [],
          tierBoards: [],
          tierLanes: [],
          timelineEntries: [],
          version: 1,
          workContributors: [],
          workRelations: [],
          works: [buildWorkRecord('import-work')],
          workSeriesLinks: [],
        }),
      ],
      'work-archive-full-backup-2026-05-21.json',
      { type: 'application/json' },
    );

    await user.upload(screen.getByLabelText('JSON 백업 파일 선택'), backupFile);

    expect(await screen.findByText('백업 범위')).toBeInTheDocument();
    expect(screen.getByText('전체 JSON')).toBeInTheDocument();
    expect(screen.getByText('백업 스키마')).toBeInTheDocument();
    expect(
      screen.getByText('작품 1개 · 권별 기록 0개 · 타임라인 0개'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('TTBKey')).not.toBeInTheDocument();

    await openSettingsSection(user, 'security');

    expect(screen.getByText('로컬 우선 게스트')).toBeInTheDocument();
    expect(screen.queryByText('Local-first guest')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
