import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';
import { AuthContext, type AuthContextValue } from '@features/auth';
import { getWorkArchiveDb, workArchiveDbManager } from '@features/works';
import { worksService } from '@features/works';
import { syncService } from '../services/sync.service';
import { useAutoSync } from './useAutoSync';

const authValue: AuthContextValue = {
  archiveScopeKey: 'work-archive-db-user-user-1',
  isLoading: false,
  mode: 'authenticated',
  sessionStatus: 'authenticated',
  user: {
    avatarUrl: '',
    email: 'user@example.com',
    id: 'user-1',
    nickname: 'User',
  },
  signOut: vi.fn(),
};

const guestAuthValue: AuthContextValue = {
  archiveScopeKey: 'work-archive-db-guest',
  isLoading: false,
  mode: 'guest',
  sessionStatus: 'guest',
  user: null,
  signOut: vi.fn(),
};

function AutoSyncProbe() {
  useAutoSync({
    debounceMs: 10,
    pullMinIntervalMs: 0,
  });

  return null;
}

function AutoSyncBackoffProbe() {
  useAutoSync({
    debounceMs: 10,
    pullFailureBackoffMs: 30,
    pullMinIntervalMs: 0,
  });

  return null;
}

function renderAutoSync() {
  return render(
    <AuthContext.Provider value={authValue}>
      <AutoSyncProbe />
    </AuthContext.Provider>,
  );
}

function renderGuestAutoSync() {
  return render(
    <AuthContext.Provider value={guestAuthValue}>
      <AutoSyncProbe />
    </AuthContext.Provider>,
  );
}

function renderAutoSyncBackoff() {
  return render(
    <AuthContext.Provider value={authValue}>
      <AutoSyncBackoffProbe />
    </AuthContext.Provider>,
  );
}

function buildPullResult(overrides = {}) {
  return {
    appliedCount: 0,
    messages: ['가져올 변경 사항이 없습니다.'],
    nextSince: null,
    pulledAt: null,
    pulledCount: 0,
    requestFailed: false,
    skippedCount: 0,
    ...overrides,
  } satisfies Awaited<ReturnType<typeof syncService.pullRemoteChanges>>;
}

function buildPushResult() {
  return {
    appliedCount: 0,
    attemptedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    messages: ['동기화할 변경 사항이 없습니다.'],
    processedAt: null,
    requestFailed: false,
  } satisfies Awaited<ReturnType<typeof syncService.pushQueuedChanges>>;
}

function buildWorkRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  const now = new Date().toISOString();

  return {
    author: 'Frank Herbert',
    catalogTitleId: null,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    description: '',
    droppedAt: null,
    favorite: false,
    genres: ['Science Fiction'],
    id: crypto.randomUUID(),
    importDraft: null,
    lastConsumedAt: null,
    lastConsumedLabel: null,
    personalTags: [],
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    rating: null,
    review: '',
    serialStatus: null,
    serverVersion: 1,
    shortReview: '',
    startedAt: null,
    status: 'planned',
    syncStatus: 'pending',
    thumbnailUrl: '',
    title: 'Dune',
    type: 'novel',
    updatedAt: now,
    ...overrides,
  };
}

async function clearCurrentArchiveDb() {
  const db = getWorkArchiveDb();

  await db.transaction('rw', [db.works, db.syncQueue], async () => {
    await db.works.clear();
    await db.syncQueue.clear();
  });
}

describe('useAutoSync', () => {
  beforeEach(async () => {
    workArchiveDbManager.switchToUser('user-1');
    await clearCurrentArchiveDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pulls once for an authenticated archive and pulls again on focus', async () => {
    const pullSpy = vi
      .spyOn(syncService, 'pullRemoteChanges')
      .mockResolvedValue(buildPullResult());
    vi.spyOn(syncService, 'pushQueuedChanges').mockResolvedValue(
      buildPushResult(),
    );

    renderAutoSync();

    await waitFor(() => {
      expect(pullSpy).toHaveBeenCalledTimes(1);
    });
    await pullSpy.mock.results[0]?.value;

    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(pullSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('backs off automatic pull after a failed request before retrying on focus', async () => {
    vi.useFakeTimers();
    const pullSpy = vi
      .spyOn(syncService, 'pullRemoteChanges')
      .mockResolvedValueOnce(
        buildPullResult({
          messages: ['요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'],
          requestFailed: true,
          retryAfterMs: 80,
        }),
      )
      .mockResolvedValue(buildPullResult());
    vi.spyOn(syncService, 'pushQueuedChanges').mockResolvedValue(
      buildPushResult(),
    );

    renderAutoSyncBackoff();

    await vi.advanceTimersByTimeAsync(0);
    expect(pullSpy).toHaveBeenCalledTimes(1);
    await pullSpy.mock.results[0]?.value;

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expect(pullSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(79);
    expect(pullSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(pullSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('debounces a push when local-first writes add sync queue items', async () => {
    vi.spyOn(syncService, 'pullRemoteChanges').mockResolvedValue(
      buildPullResult(),
    );
    const pushSpy = vi
      .spyOn(syncService, 'pushQueuedChanges')
      .mockResolvedValue(buildPushResult());

    renderAutoSync();

    await worksService.createWork({
      author: 'Frank Herbert',
      description: '',
      favorite: false,
      genres: ['Science Fiction'],
      rating: null,
      review: '',
      shortReview: '',
      status: 'planned',
      thumbnailUrl: '',
      title: 'Dune',
      type: 'novel',
    });

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps an offline account queue local until authentication is restored', async () => {
    const pullSpy = vi
      .spyOn(syncService, 'pullRemoteChanges')
      .mockResolvedValue(buildPullResult());
    const pushSpy = vi
      .spyOn(syncService, 'pushQueuedChanges')
      .mockResolvedValue(buildPushResult());

    render(
      <AuthContext.Provider
        value={{
          ...authValue,
          sessionStatus: 'offline',
        }}
      >
        <AutoSyncProbe />
      </AuthContext.Provider>,
    );

    await worksService.createWork({
      author: 'Octavia Butler',
      description: '',
      favorite: false,
      genres: [],
      rating: null,
      review: '',
      shortReview: '',
      status: 'planned',
      thumbnailUrl: '',
      title: 'Kindred',
      type: 'novel',
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(await getWorkArchiveDb().syncQueue.count()).toBe(1);
    expect(pullSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('keeps guest local-first writes out of automatic sync', async () => {
    workArchiveDbManager.switchToGuest();
    await clearCurrentArchiveDb();
    const pullSpy = vi
      .spyOn(syncService, 'pullRemoteChanges')
      .mockResolvedValue(buildPullResult());
    const pushSpy = vi
      .spyOn(syncService, 'pushQueuedChanges')
      .mockResolvedValue(buildPushResult());

    renderGuestAutoSync();

    await worksService.createWork({
      author: 'Ursula K. Le Guin',
      description: '',
      favorite: false,
      genres: ['Fantasy'],
      rating: null,
      review: '',
      shortReview: '',
      status: 'planned',
      thumbnailUrl: '',
      title: 'A Wizard of Earthsea',
      type: 'novel',
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(pullSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not automatically push queue items that require conflict review', async () => {
    vi.spyOn(syncService, 'pullRemoteChanges').mockResolvedValue(
      buildPullResult(),
    );
    const pushSpy = vi
      .spyOn(syncService, 'pushQueuedChanges')
      .mockResolvedValue(buildPushResult());
    const conflictedWork = buildWorkRecord({
      syncStatus: 'conflict',
      title: 'Remote Review Needed',
    });

    await getWorkArchiveDb().syncQueue.add({
      autoMerge: null,
      clientMutationId: crypto.randomUUID(),
      conflict: {
        code: 'conflict_remote_newer',
        detectedAt: new Date().toISOString(),
        message: 'Remote record is newer.',
        remote: {
          ...conflictedWork,
          title: 'Remote Copy',
        },
      },
      createdAt: new Date().toISOString(),
      entityId: conflictedWork.id,
      entityType: 'work',
      id: crypto.randomUUID(),
      lastError: 'Remote record is newer.',
      nextRetryAt: null,
      operation: 'update',
      payload: conflictedWork,
      retryCount: 1,
      source: 'edit_form',
    });

    renderAutoSync();

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(pushSpy).not.toHaveBeenCalled();
  });
});
