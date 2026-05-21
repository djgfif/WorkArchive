import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../auth/context/AuthContext';
import { workArchiveDbManager } from '../../works/db/work-archive.db';
import { worksService } from '../../works/services/works.service';
import { syncService } from '../services/sync.service';
import { useAutoSync } from './useAutoSync';

const authValue: AuthContextValue = {
  archiveScopeKey: 'work-archive-db-user-user-1',
  isLoading: false,
  mode: 'authenticated',
  user: {
    avatarUrl: '',
    email: 'user@example.com',
    id: 'user-1',
    nickname: 'User',
  },
  signOut: vi.fn(),
};

function AutoSyncProbe() {
  useAutoSync({
    debounceMs: 10,
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

function buildPullResult() {
  return {
    appliedCount: 0,
    messages: ['가져올 변경 사항이 없습니다.'],
    nextSince: null,
    pulledAt: null,
    pulledCount: 0,
    requestFailed: false,
    skippedCount: 0,
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

describe('useAutoSync', () => {
  beforeEach(() => {
    workArchiveDbManager.switchToUser('user-1');
  });

  afterEach(() => {
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

    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(pullSpy).toHaveBeenCalledTimes(2);
    });
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
});
