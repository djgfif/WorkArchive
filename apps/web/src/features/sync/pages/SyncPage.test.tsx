import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserReleaseRecord, WorkRecord } from '@work-archive/shared-types';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { workArchiveDbManager } from '../../works/db/work-archive.db';
import { releaseRecordsRepository } from '../../works/services/release-records.repository';
import { worksRepository } from '../../works/services/works.repository';
import { worksService } from '../../works/services/works.service';
import { syncQueueRepository } from '../services/sync-queue.repository';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function buildStoredWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const createdAt = overrides.createdAt ?? '2026-04-18T00:00:00.000Z';
  const updatedAt = overrides.updatedAt ?? createdAt;

  return {
    id: overrides.id ?? crypto.randomUUID(),
    catalogTitleId: overrides.catalogTitleId ?? null,
    importDraft: overrides.importDraft ?? null,
    type: overrides.type ?? 'novel',
    title: overrides.title ?? 'Stored Work',
    author: overrides.author ?? 'Frank Herbert',
    genres: overrides.genres ?? ['Science Fiction'],
    description: overrides.description ?? '',
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    status: overrides.status ?? 'planned',
    rating: overrides.rating ?? null,
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

function buildReleaseRecord(
  overrides: Partial<UserReleaseRecord> = {},
): UserReleaseRecord {
  const createdAt = overrides.createdAt ?? '2026-04-18T00:00:00.000Z';
  const updatedAt = overrides.updatedAt ?? createdAt;

  return {
    id: overrides.id ?? crypto.randomUUID(),
    userWorkRecordId: overrides.userWorkRecordId ?? 'parent-work',
    catalogReleaseId: overrides.catalogReleaseId ?? 'catalog-release-1',
    status: overrides.status ?? 'planned',
    rating: overrides.rating ?? null,
    shortReview: overrides.shortReview ?? '',
    review: overrides.review ?? '',
    favorite: overrides.favorite ?? false,
    createdAt,
    updatedAt,
    deletedAt: overrides.deletedAt ?? null,
    syncStatus: overrides.syncStatus ?? 'local-only',
    serverVersion: overrides.serverVersion ?? 0,
  };
}

describe('SyncPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs a manual sync and shows the success state', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    const localWork = await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const queueItems = await syncQueueRepository.listAll();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'applied',
              message: 'Queued record created on the server.',
              work: {
                ...localWork,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T01:00:00.000Z',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          pulledAt: '2026-04-18T01:00:01.000Z',
          nextSince: '2026-04-18T01:00:00.000Z',
          changes: [],
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('동기화 대기 중')).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '수동 동기화' }));

    expect(await screen.findByText('최근 동기화 결과')).toBeInTheDocument();
    expect(
      await screen.findByText(/보내기 1건 반영 1건 충돌 0건 실패 0건/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('현재 대기 중인 변경 사항이 없습니다.'),
    ).toBeInTheDocument();

    const pushHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    const pullHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;

    expect(pushHeaders.get('authorization')).toBe('Bearer access-token');
    expect(pullHeaders.get('authorization')).toBe('Bearer access-token');
  });

  it('shows explicit guest mode messaging and disables manual sync', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('로그인하면 동기화할 수 있습니다')).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/게스트 모드에서는 기록이 이 기기에만 저장됩니다/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '로그인 후 동기화' })).toBeDisabled();
  });

  it('returns to guest mode when a protected sync request cannot refresh the session', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
      }),
    );

    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        ),
    );

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findAllByText(/frieren@example\.com/)).not.toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: '수동 동기화' }));

    expect(await screen.findByText('로그인하면 동기화할 수 있습니다')).toBeInTheDocument();
    expect(await screen.findAllByText('게스트 모드')).not.toHaveLength(0);
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });

  it('groups queued changes into pending, failed, and conflict sections', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    const pendingWork = await worksService.createWork({
      type: 'novel',
      title: 'Pending Work',
      author: 'Author One',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const failedWork = await worksService.createWork({
      type: 'novel',
      title: 'Failed Work',
      author: 'Author Two',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const conflictWork = await worksService.createWork({
      type: 'novel',
      title: 'Conflict Work',
      author: 'Author Three',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const queueItems = await syncQueueRepository.listAll();
    const failedQueueItem = queueItems.find((item) => item.entityId === failedWork.id);
    const conflictQueueItem = queueItems.find(
      (item) => item.entityId === conflictWork.id,
    );

    expect(failedQueueItem).toBeDefined();
    expect(conflictQueueItem).toBeDefined();

    await syncQueueRepository.markFailed(failedQueueItem!.id, 'Request timed out');
    await syncQueueRepository.markFailed(
      conflictQueueItem!.id,
      'Remote conflict detected',
    );
    await worksRepository.update({
      ...(await worksRepository.getById(conflictWork.id))!,
      syncStatus: 'conflict',
      updatedAt: '2026-04-18T02:00:00.000Z',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        }),
      ),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    const pendingSection = await screen.findByTestId('sync-section-pending');
    const failedSection = screen.getByTestId('sync-section-failed');
    const conflictSection = screen.getByTestId('sync-section-conflict');

    expect(within(pendingSection).getByText('Pending Work')).toBeInTheDocument();
    expect(within(pendingSection).getByText(pendingWork.id)).toBeInTheDocument();
    expect(within(failedSection).getByText('Failed Work')).toBeInTheDocument();
    expect(within(failedSection).getByText('Request timed out')).toBeInTheDocument();
    expect(within(conflictSection).getByText('Conflict Work')).toBeInTheDocument();
    expect(
      within(conflictSection).getByText('Remote conflict detected'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '다시 동기화 시도' }).length).toBe(3);
    expect(
      within(failedSection).getByRole('link', { name: '기록 보기' }),
    ).toHaveAttribute('href', `/works/${failedWork.id}`);
  });

  it('links release-record queue items to the parent work detail when available', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    const parentWork = buildStoredWork({
      id: 'parent-work',
      title: 'Parent Work',
    });

    await worksRepository.create(parentWork);

    const releaseRecord = buildReleaseRecord({
      id: 'release-record-1',
      userWorkRecordId: parentWork.id,
    });

    await releaseRecordsRepository.create(releaseRecord);
    const queueItem = await syncQueueRepository.enqueueReleaseRecordChange(
      releaseRecord,
      'create',
    );

    expect(queueItem).not.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        }),
      ),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    const releaseRecordCard = await screen.findByTestId(`sync-item-${queueItem!.id}`);

    expect(within(releaseRecordCard).getByText(/Parent Work/)).toBeInTheDocument();
    expect(
      within(releaseRecordCard).getByRole('link', { name: '기록 보기' }),
    ).toHaveAttribute('href', `/works/${parentWork.id}`);
  });
});
