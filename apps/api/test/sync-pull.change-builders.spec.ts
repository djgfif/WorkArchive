import { describe, expect, it } from '@jest/globals';
import { WorkSyncStatus } from '@prisma/client';

import {
  buildOrderedPullChanges,
} from '../src/modules/sync/services/sync-pull.change-builders';
import type { PullChangeRecords } from '../src/modules/sync/services/sync-pull.records';

const now = new Date('2026-04-18T00:00:00.000Z');

function emptyRecords(): PullChangeRecords {
  return {
    contributors: [],
    releaseRecords: [],
    series: [],
    tierBoardAssets: [],
    tierBoardCards: [],
    tierLanes: [],
    tierBoards: [],
    timelineEntries: [],
    workContributors: [],
    workRelations: [],
    workSeriesLinks: [],
    works: [],
  };
}

describe('sync pull change builders', () => {
  it('orders changes by updated time, entity type, then cursor id comparator', () => {
    const records = emptyRecords();
    records.series = [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
        title: 'Series B',
        normalizedTitle: 'series b',
        aliases: [],
        kind: 'series',
        parentId: null,
        description: '',
        thumbnailUrl: '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
        title: 'Series A',
        normalizedTitle: 'series a',
        aliases: [],
        kind: 'series',
        parentId: null,
        description: '',
        thumbnailUrl: '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
      },
    ];
    records.contributors = [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
        name: 'Contributor C',
        normalizedName: 'contributor c',
        aliases: [],
        entityType: 'person',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: WorkSyncStatus.synced,
        serverVersion: 1,
      },
    ];

    const changes = buildOrderedPullChanges(records, (left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );

    expect(changes.map((entry) => entry.cursor)).toEqual([
      {
        entityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        entityType: 'contributor',
        updatedAt: now.toISOString(),
      },
      {
        entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        entityType: 'series',
        updatedAt: now.toISOString(),
      },
      {
        entityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        entityType: 'series',
        updatedAt: now.toISOString(),
      },
    ]);
  });

  it('maps tier board asset tombstones with delete operation and payload dates', () => {
    const deletedAt = new Date('2026-04-18T01:00:00.000Z');
    const records = emptyRecords();
    records.tierBoardAssets = [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        boardId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        cardId: null,
        kind: 'cover',
        storageType: 'remote_url',
        objectUrl: 'https://example.com/cover.jpg',
        originalName: 'cover.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
        createdAt: now,
        updatedAt: deletedAt,
        deletedAt,
        syncStatus: 'synced',
        serverVersion: 2,
      },
    ];

    expect(
      buildOrderedPullChanges(records, () => 0).map((entry) => entry.change),
    ).toEqual([
      {
        entityType: 'tier_board_asset',
        entityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        operation: 'delete',
        tierBoardAsset: {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          boardId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          cardId: null,
          kind: 'cover',
          storageType: 'remote_url',
          objectUrl: 'https://example.com/cover.jpg',
          originalName: 'cover.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
          createdAt: now.toISOString(),
          updatedAt: deletedAt.toISOString(),
          deletedAt: deletedAt.toISOString(),
          syncStatus: 'synced',
          serverVersion: 2,
        },
      },
    ]);
  });
});
