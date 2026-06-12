import type { PullSyncChangeDto } from '../dto/pull-sync-response.dto';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { PullChangeRecords } from './sync-pull.records';

export function sortPushChangesByCreatedAt(changes: PushSyncChangeDto[]) {
  return changes
    .map((change, index) => ({
      change,
      index,
      timestamp: Date.parse(change.createdAt),
    }))
    .sort((left, right) => {
      const timestampDelta = left.timestamp - right.timestamp;

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return left.index - right.index;
    })
    .map(({ change }) => change);
}

export function countPushResultStatuses(results: PushSyncResultDto[]) {
  return {
    appliedCount: results.filter((result) => result.status === 'applied')
      .length,
    conflictCount: results.filter((result) => result.status === 'conflict')
      .length,
    failedCount: results.filter((result) => result.status === 'failed').length,
  };
}

export function countPullOperations(changes: PullSyncChangeDto[]) {
  return {
    deleteCount: changes.filter((change) => change.operation === 'delete')
      .length,
    upsertCount: changes.filter((change) => change.operation === 'upsert')
      .length,
  };
}

export function sortPullChangedRecordsByUpdatedAt(records: PullChangeRecords) {
  return [
    ...records.works,
    ...records.releaseRecords,
    ...records.timelineEntries,
    ...records.series,
    ...records.contributors,
    ...records.workSeriesLinks,
    ...records.workContributors,
    ...records.workRelations,
    ...records.tierBoards,
    ...records.tierLanes,
    ...records.tierBoardCards,
    ...records.tierBoardAssets,
  ].sort(
    (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
  );
}
