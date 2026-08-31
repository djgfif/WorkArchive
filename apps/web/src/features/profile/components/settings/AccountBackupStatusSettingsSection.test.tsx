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

function buildWork(
  title: string,
  overrides: Partial<WorkRecord> = {},
): WorkRecord {
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
    expect(confirmDialogAdapter.confirm).toHaveBeenCalledWith({
      title: '충돌 해결을 적용할까요?',
      description: expect.stringContaining(
        '현재 내 기록 전체를 계정 백업 값으로 바꿉니다.',
      ),
    });
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

  it('previews selected remote groups and warns before merging deletion state', async () => {
    const user = userEvent.setup();
    const item = buildConflictItem();
    item.conflictRemote = buildWork('서버 제목', {
      deletedAt: NOW,
      serverVersion: 2,
      syncStatus: 'synced',
    });
    vi.spyOn(confirmDialogAdapter, 'confirm').mockResolvedValue(true);
    const resolveSpy = vi
      .spyOn(syncService, 'resolveConflictWithMergedFields')
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

    expect(
      screen.getByText('아직 계정 백업에서 가져올 항목을 선택하지 않았습니다.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('checkbox', { name: '제목과 작가·제작자' }),
    );
    await user.click(screen.getByRole('checkbox', { name: '삭제 상태' }));

    expect(
      screen.getByText(
        '계정 백업에서 가져올 항목: 제목과 작가·제작자, 삭제 상태',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '삭제 상태는 작품의 휴지통 여부를 바꿉니다. 적용 결과를 한 번 더 확인하세요.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선택 병합' }));

    expect(resolveSpy).toHaveBeenCalledWith(item.id, [
      'title',
      'author',
      'deletedAt',
    ]);
    expect(confirmDialogAdapter.confirm).toHaveBeenCalledWith({
      title: '충돌 해결을 적용할까요?',
      description: expect.stringContaining(
        '선택한 항목(제목과 작가·제작자, 삭제 상태)만 계정 백업 값으로 바꾸고 나머지는 내 기록을 유지합니다.',
      ),
    });
  });
});
