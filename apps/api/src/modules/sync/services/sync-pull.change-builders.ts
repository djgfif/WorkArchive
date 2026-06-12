import { toUserReleaseRecordResponse } from '../../user-records/user-release-records.service';
import { toUserTimelineEntryResponse } from '../../user-records/user-timeline-entries.service';
import { toFlatWorkResponse } from '../../works/work-aggregate';
import type { OrderedPullChange } from '../sync-internal.types';
import {
  toPullSyncContributorPayload,
  toPullSyncSeriesPayload,
  toPullSyncTierBoardAssetPayload,
  toPullSyncTierBoardCardPayload,
  toPullSyncTierBoardPayload,
  toPullSyncTierLanePayload,
  toPullSyncWorkContributorPayload,
  toPullSyncWorkRelationPayload,
  toPullSyncWorkSeriesLinkPayload,
} from './sync-pull.payload-mappers';
import type { PullChangeRecords } from './sync-pull.records';

export function buildOrderedPullChanges(
  records: PullChangeRecords,
  compareEntityIds: (left: string, right: string) => number,
) {
  const {
    contributors,
    releaseRecords,
    series,
    tierBoardAssets,
    tierBoardCards,
    tierLanes,
    tierBoards,
    timelineEntries,
    workContributors,
    workRelations,
    workSeriesLinks,
    works,
  } = records;

  return [
    ...works.map<OrderedPullChange>((work) => {
      const updatedAt = work.updatedAt.toISOString();

      return {
        change: {
          entityType: 'work',
          entityId: work.id,
          operation: work.deletedAt === null ? 'upsert' : 'delete',
          work: toFlatWorkResponse(work),
        },
        cursor: {
          entityId: work.id,
          entityType: 'work',
          updatedAt,
        },
        updatedAtMs: work.updatedAt.getTime(),
      };
    }),
    ...releaseRecords.map<OrderedPullChange>((releaseRecord) => {
      const updatedAt = releaseRecord.updatedAt.toISOString();

      return {
        change: {
          entityType: 'release_record',
          entityId: releaseRecord.id,
          operation: releaseRecord.deletedAt === null ? 'upsert' : 'delete',
          releaseRecord: toUserReleaseRecordResponse(releaseRecord),
        },
        cursor: {
          entityId: releaseRecord.id,
          entityType: 'release_record',
          updatedAt,
        },
        updatedAtMs: releaseRecord.updatedAt.getTime(),
      };
    }),
    ...timelineEntries.map<OrderedPullChange>((timelineEntry) => {
      const updatedAt = timelineEntry.updatedAt.toISOString();

      return {
        change: {
          entityType: 'timeline_entry',
          entityId: timelineEntry.id,
          operation: timelineEntry.deletedAt === null ? 'upsert' : 'delete',
          timelineEntry: toUserTimelineEntryResponse(timelineEntry),
        },
        cursor: {
          entityId: timelineEntry.id,
          entityType: 'timeline_entry',
          updatedAt,
        },
        updatedAtMs: timelineEntry.updatedAt.getTime(),
      };
    }),
    ...series.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'series',
        'series',
        toPullSyncSeriesPayload(entry),
      ),
    ),
    ...contributors.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'contributor',
        'contributor',
        toPullSyncContributorPayload(entry),
      ),
    ),
    ...workSeriesLinks.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'work_series_link',
        'workSeriesLink',
        toPullSyncWorkSeriesLinkPayload(entry),
      ),
    ),
    ...workContributors.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'work_contributor',
        'workContributor',
        toPullSyncWorkContributorPayload(entry),
      ),
    ),
    ...workRelations.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'work_relation',
        'workRelation',
        toPullSyncWorkRelationPayload(entry),
      ),
    ),
    ...tierBoards.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'tier_board',
        'tierBoard',
        toPullSyncTierBoardPayload(entry),
      ),
    ),
    ...tierLanes.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'tier_lane',
        'tierLane',
        toPullSyncTierLanePayload(entry),
      ),
    ),
    ...tierBoardCards.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'tier_board_card',
        'tierBoardCard',
        toPullSyncTierBoardCardPayload(entry),
      ),
    ),
    ...tierBoardAssets.map<OrderedPullChange>((entry) =>
      buildPullChange(
        entry,
        'tier_board_asset',
        'tierBoardAsset',
        toPullSyncTierBoardAssetPayload(entry),
      ),
    ),
  ].sort((left, right) => {
    const updatedAtDelta = left.updatedAtMs - right.updatedAtMs;

    if (updatedAtDelta !== 0) {
      return updatedAtDelta;
    }

    const entityTypeDelta = left.cursor.entityType.localeCompare(
      right.cursor.entityType,
    );

    if (entityTypeDelta !== 0) {
      return entityTypeDelta;
    }

    return compareEntityIds(left.cursor.entityId, right.cursor.entityId);
  });
}

function buildPullChange<
  TRecord extends { id: string; updatedAt: Date; deletedAt: Date | null },
  TPayloadKey extends string,
>(
  record: TRecord,
  entityType: OrderedPullChange['cursor']['entityType'],
  payloadKey: TPayloadKey,
  payload: unknown,
): OrderedPullChange {
  const updatedAt = record.updatedAt.toISOString();

  return {
    change: {
      entityType,
      entityId: record.id,
      operation: record.deletedAt === null ? 'upsert' : 'delete',
      [payloadKey]: payload,
    },
    cursor: {
      entityId: record.id,
      entityType,
      updatedAt,
    },
    updatedAtMs: record.updatedAt.getTime(),
  } as OrderedPullChange;
}
