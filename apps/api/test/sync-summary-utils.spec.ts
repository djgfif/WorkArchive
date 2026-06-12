import { describe, expect, it } from '@jest/globals';

import type { PullSyncChangeDto } from '../src/modules/sync/dto/pull-sync-response.dto';
import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import type { PushSyncResultDto } from '../src/modules/sync/dto/push-sync-response.dto';
import type { PullChangeRecords } from '../src/modules/sync/services/sync-pull.records';
import {
  countPullOperations,
  countPushResultStatuses,
  sortPullChangedRecordsByUpdatedAt,
  sortPushChangesByCreatedAt,
} from '../src/modules/sync/services/sync-summary-utils';

function buildPushChange(
  queueId: string,
  createdAt: string,
): PushSyncChangeDto {
  return {
    queueId,
    entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    entityType: 'work',
    operation: 'update',
    createdAt,
    payload: {},
  } as PushSyncChangeDto;
}

describe('sync summary utils', () => {
  it('sorts push changes by createdAt while preserving input order ties', () => {
    const firstTie = buildPushChange('first-tie', '2026-04-18T01:00:00.000Z');
    const earlier = buildPushChange('earlier', '2026-04-18T00:00:00.000Z');
    const secondTie = buildPushChange(
      'second-tie',
      '2026-04-18T01:00:00.000Z',
    );

    expect(
      sortPushChangesByCreatedAt([firstTie, earlier, secondTie]).map(
        (change) => change.queueId,
      ),
    ).toEqual(['earlier', 'first-tie', 'second-tie']);
  });

  it('counts push result statuses for summary logs', () => {
    expect(
      countPushResultStatuses([
        { status: 'applied' },
        { status: 'conflict' },
        { status: 'failed' },
        { status: 'applied' },
      ] as PushSyncResultDto[]),
    ).toEqual({
      appliedCount: 2,
      conflictCount: 1,
      failedCount: 1,
    });
  });

  it('counts pull operations for summary logs', () => {
    expect(
      countPullOperations([
        { operation: 'upsert' },
        { operation: 'delete' },
        { operation: 'upsert' },
      ] as PullSyncChangeDto[]),
    ).toEqual({
      deleteCount: 1,
      upsertCount: 2,
    });
  });

  it('sorts all pull changed record groups by updatedAt', () => {
    const records = {
      contributors: [{ id: 'contributor', updatedAt: new Date('2026-04-18T03:00:00.000Z') }],
      releaseRecords: [{ id: 'release', updatedAt: new Date('2026-04-18T01:00:00.000Z') }],
      series: [],
      tierBoardAssets: [],
      tierBoardCards: [],
      tierLanes: [{ id: 'lane', updatedAt: new Date('2026-04-18T02:00:00.000Z') }],
      tierBoards: [],
      timelineEntries: [],
      workContributors: [],
      workRelations: [],
      workSeriesLinks: [],
      works: [{ id: 'work', updatedAt: new Date('2026-04-18T00:00:00.000Z') }],
    } as unknown as PullChangeRecords;

    expect(
      sortPullChangedRecordsByUpdatedAt(records).map((record) => record.id),
    ).toEqual(['work', 'release', 'lane', 'contributor']);
  });
});
