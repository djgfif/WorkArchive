import type { ReactNode } from 'react';

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  SyncQueueItemRecord,
  TierBoardAssetRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import { AuthContext, type AuthContextValue } from '@features/auth';
import { getWorkArchiveDb } from '../../works/storage';
import { useSyncDashboard } from './useSyncDashboard';

const now = '2026-04-18T00:00:00.000Z';

function renderDashboardHook() {
  const authValue: AuthContextValue = {
    archiveScopeKey: 'guest',
    isLoading: false,
    mode: 'guest',
    signOut: vi.fn(async () => undefined),
    user: null,
  };

  return renderHook(() => useSyncDashboard(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    ),
  });
}

describe('useSyncDashboard', () => {
  it('shows the stored tier board asset server version in queue diagnostics', async () => {
    const db = getWorkArchiveDb();
    const board: TierBoardRecord = {
      id: 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901',
      title: 'Favorites',
      description: '',
      slug: 'favorites',
      boardType: 'classic_tier',
      visibility: 'private',
      coverImageUrl: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'synced',
      serverVersion: 2,
    };
    const asset: TierBoardAssetRecord = {
      id: 'dc42d556-13a5-4b28-897c-5c79d68a7f79',
      boardId: board.id,
      cardId: null,
      kind: 'image',
      storageType: 'remote_url',
      objectUrl: 'https://example.com/cover.jpg',
      originalName: 'cover.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1200,
      createdAt: now,
      updatedAt: '2026-04-18T00:10:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      serverVersion: 4,
    };
    const queueItem: SyncQueueItemRecord<TierBoardAssetRecord> = {
      id: '9bed3916-6d5f-427d-86de-3952a015b23d',
      clientMutationId: 'a808b443-6d81-4f9f-bbe4-af6f48379464',
      entityType: 'tier_board_asset',
      entityId: asset.id,
      operation: 'update',
      payload: asset,
      source: 'tier_board_asset_update',
      createdAt: '2026-04-18T00:11:00.000Z',
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      autoMerge: null,
      conflict: null,
    };

    await db.tierBoards.add(board);
    await db.tierBoardAssets.add(asset);
    await db.syncQueue.add(queueItem);

    const { result } = renderDashboardHook();

    await waitFor(() => {
      expect(result.current.pendingItems).toEqual([
        expect.objectContaining({
          entityId: asset.id,
          entityType: 'tier_board_asset',
          serverVersion: 4,
        }),
      ]);
    });
  });
});
