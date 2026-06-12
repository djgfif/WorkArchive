import { describe, expect, it } from '@jest/globals';
import { WorkSyncStatus } from '@prisma/client';

import {
  toPullSyncSeriesPayload,
  toPullSyncTierBoardCardPayload,
  toPullSyncWorkSeriesLinkPayload,
} from '../src/modules/sync/services/sync-pull.payload-mappers';

const createdAt = new Date('2026-04-18T00:00:00.000Z');
const updatedAt = new Date('2026-04-18T01:00:00.000Z');
const deletedAt = new Date('2026-04-18T02:00:00.000Z');

describe('sync pull payload mappers', () => {
  it('maps series records to server sync payloads with normalized null dates', () => {
    expect(
      toPullSyncSeriesPayload({
        aliases: ['Alias'],
        createdAt,
        deletedAt: null,
        description: 'Series description',
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        kind: 'series',
        normalizedTitle: 'series title',
        parentId: null,
        serverVersion: 3,
        syncStatus: WorkSyncStatus.pending,
        thumbnailUrl: 'https://example.com/series.jpg',
        title: 'Series Title',
        updatedAt,
        userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
      }),
    ).toEqual({
      aliases: ['Alias'],
      createdAt: createdAt.toISOString(),
      deletedAt: null,
      description: 'Series description',
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'series',
      normalizedTitle: 'series title',
      parentId: null,
      serverVersion: 3,
      syncStatus: WorkSyncStatus.synced,
      thumbnailUrl: 'https://example.com/series.jpg',
      title: 'Series Title',
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('maps work series link orderIndex undefined to null', () => {
    expect(
      toPullSyncWorkSeriesLinkPayload({
        createdAt,
        deletedAt,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        orderIndex: null,
        orderLabel: '1권',
        role: 'main',
        serverVersion: 4,
        syncStatus: WorkSyncStatus.synced,
        updatedAt,
        userSeries: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
        },
        userSeriesId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userWork: {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          userId: '2c92b57e-e529-4344-bd62-0cff4de5dfe2',
        },
        userWorkId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    ).toEqual({
      createdAt: createdAt.toISOString(),
      deletedAt: deletedAt.toISOString(),
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      orderIndex: null,
      orderLabel: '1권',
      role: 'main',
      seriesId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      serverVersion: 4,
      syncStatus: WorkSyncStatus.synced,
      updatedAt: updatedAt.toISOString(),
      workId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
  });

  it('maps tier board cards with userWorkId as workId', () => {
    expect(
      toPullSyncTierBoardCardPayload({
        boardId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        cardSourceType: 'work',
        createdAt,
        deletedAt: null,
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        imageUrl: 'https://example.com/card.jpg',
        laneId: null,
        note: 'note',
        orderIndex: 7,
        serverVersion: 5,
        subtitle: 'subtitle',
        syncStatus: WorkSyncStatus.pending,
        title: 'Card',
        updatedAt,
        userWorkId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      boardId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      cardSourceType: 'work',
      createdAt: createdAt.toISOString(),
      deletedAt: null,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      imageUrl: 'https://example.com/card.jpg',
      laneId: null,
      note: 'note',
      orderIndex: 7,
      serverVersion: 5,
      subtitle: 'subtitle',
      syncStatus: WorkSyncStatus.synced,
      title: 'Card',
      updatedAt: updatedAt.toISOString(),
      workId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
