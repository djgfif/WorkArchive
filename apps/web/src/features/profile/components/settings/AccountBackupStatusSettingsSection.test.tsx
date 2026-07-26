import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import { syncService, type SyncDashboardItem } from '@features/sync';
import { confirmDialogAdapter } from '@shared/runtime/dialog-adapter';
import { renderWithProviders } from '@test/render-with-providers';
import { AccountBackupStatusSettingsSection } from './AccountBackupStatusSettingsSection';

const NOW = '2026-07-26T00:00:00.000Z';

function buildWork(title: string, overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    author: '',
    completedAt: null,
    createdAt: NOW,
    deletedAt: null,
    description: '',
    droppedAt: null,
    favorite: false,
    genres: [],
    id: 'work-1',
    lastConsumedAt: null,
    lastConsumedLabel: '',
    personalTags: [],
    progressCurrent: null,
    progressTotal: null,
    progressUnit: null,
    rating: null,
    review: '',
    serverVersion: 1,
    shortReview: '',
    startedAt: null,
    status: 'planned',
    syncStatus: 'conflict',
    thumbnailUrl: '',
    title,
    type: 'novel',
    updatedAt: NOW,
    ...overrides,
  };
}

function buildConflictItem(): SyncDashboardItem {
  const local = buildWork('로컬 제목');
  const remote = buildWork('서버 제목', {
    serverVersion: 2,
    syncStatus: 'synced',
  });

  return {
    autoMerge: null,
    conflictCode: null,
    conflictMessage: 'manual conflict',
    conflictRemote: remote,
    deletedAt: null,
    entityId: local.id,
    entityType: 'work',
    id: 'queue-1',
    lastError: 'manual conflict',
    linkTo: '/works/work-1',
    localSnapshot: local,
    operation: 'update',
    retryCount: 1,
    serverVersion: 1,
    source: 'edit_form',
    state: 'conflict',
    syncStatus: 'conflict',
    title: local.title,
    updatedAt: NOW,
  };
}

describe('AccountBackupStatusSettingsSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms remote application and offers a limited undo action', async () => {
    const user = userEvent.setup();
    const item = buildConflictItem();
    vi.spyOn(confirmDialogAdapter, 'confirm').mockResolvedValue(true);
    const resolveSpy = vi
      .spyOn(syncService, 'resolveConflictWithRemote')
      .mockResolvedValue(item.conflictRemote as WorkRecord);
    const undoSpy = vi
      .spyOn(syncService, 'undoConflictResolution')
      .mockResolvedValue(item.localSnapshot as WorkRecord);

    renderWithProviders(
      <MemoryRouter>
        <AccountBackupStatusSettingsSection
          conflictItems={[item]}
          failedItems={[]}
          lastSuccessfulPullAt={null}
          mode="authenticated"
          pendingItems={[]}
          staleStatusAt={null}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: '계정 백업 기록 적용' }),
    );

    expect(confirmDialogAdapter.confirm).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith(item.id);
    expect(
      await screen.findByRole('button', { name: '방금 해결 실행 취소' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '방금 해결 실행 취소' }),
    );

    expect(undoSpy).toHaveBeenCalledWith(item.id);
    expect(
      await screen.findByText('충돌 해결 전 기록과 대기열을 복원했습니다.'),
    ).toBeInTheDocument();
  });
});
