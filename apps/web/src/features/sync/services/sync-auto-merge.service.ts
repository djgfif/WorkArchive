import type {
  ContributorRecord,
  PullSyncChange,
  PushSyncResult,
  SeriesRecord,
  SyncAutoMergeSnapshot,
  SyncEntityType,
  SyncQueuePayload,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardRecord,
  TierLaneRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkRecord,
  WorkRelationRecord,
  WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { moveUnknownGenresToPersonalTags } from '@features/works/data';

export const WORK_MERGE_FIELDS = [
  'title',
  'author',
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'progressCurrent',
  'progressTotal',
  'progressUnit',
  'lastConsumedLabel',
  'startedAt',
  'completedAt',
  'droppedAt',
  'lastConsumedAt',
  'genres',
  'personalTags',
  'description',
  'thumbnailUrl',
  'deletedAt',
] as const satisfies readonly (keyof WorkRecord)[];

export const RELEASE_RECORD_MERGE_FIELDS = [
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'deletedAt',
] as const satisfies readonly (keyof UserReleaseRecord)[];

export type WorkConflictMergeField = (typeof WORK_MERGE_FIELDS)[number];
export type ReleaseRecordConflictMergeField =
  (typeof RELEASE_RECORD_MERGE_FIELDS)[number];
export type GraphEntityRecord =
  | ContributorRecord
  | SeriesRecord
  | WorkContributorRecord
  | WorkRelationRecord
  | WorkSeriesLinkRecord;
export type TierBoardEntityRecord =
  | TierBoardRecord
  | TierLaneRecord
  | TierBoardCardRecord
  | TierBoardAssetRecord;

type AutoMergeOutcome<TPayload extends SyncQueuePayload> =
  | {
      merged: TPayload;
      mergedFields: string[];
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

export function getNowIso() {
  return new Date().toISOString();
}

function getLatestIso(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function mergeUniqueValues(left: readonly string[], right: readonly string[]) {
  return Array.from(new Set([...left, ...right]));
}

function areEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function haveSameFieldValues<TRecord extends object>(
  remote: TRecord,
  localPayload: TRecord,
  fields: readonly (keyof TRecord)[],
) {
  return fields.every((field) => areEqual(remote[field], localPayload[field]));
}

function hasDeleteUpdateCollision(
  remote: { deletedAt: string | null },
  localPayload: { deletedAt: string | null },
) {
  return remote.deletedAt !== null || localPayload.deletedAt !== null;
}

export function cloneWorkRecord(work: WorkRecord): WorkRecord {
  return {
    ...work,
    genres: [...work.genres],
    personalTags: [...work.personalTags],
  };
}

export function cloneReleaseRecord(
  releaseRecord: UserReleaseRecord,
): UserReleaseRecord {
  return {
    ...releaseRecord,
  };
}

export function cloneTimelineEntry(
  entry: TimelineEntryRecord,
): TimelineEntryRecord {
  return {
    ...entry,
  };
}

export function cloneGraphEntity<TPayload extends GraphEntityRecord>(
  payload: TPayload,
): TPayload {
  if ('aliases' in payload) {
    return {
      ...payload,
      aliases: [...payload.aliases],
    } as TPayload;
  }

  return {
    ...payload,
  };
}

export function cloneQueuePayload<TPayload extends SyncQueuePayload>(
  payload: TPayload,
): TPayload {
  if ('genres' in payload) {
    return cloneWorkRecord(payload as WorkRecord) as TPayload;
  }

  if ('catalogReleaseId' in payload) {
    return cloneReleaseRecord(payload as UserReleaseRecord) as TPayload;
  }

  if ('occurredAt' in payload) {
    return cloneTimelineEntry(payload as TimelineEntryRecord) as TPayload;
  }

  if (
    'boardType' in payload ||
    'boardId' in payload ||
    'storageType' in payload
  ) {
    return { ...payload } as TPayload;
  }

  return cloneGraphEntity(payload as GraphEntityRecord) as TPayload;
}

export function createAutoMergeSnapshot(
  mergedFields: readonly string[],
): SyncAutoMergeSnapshot {
  const fields = [...mergedFields];

  return {
    fields,
    mergedAt: getNowIso(),
    message:
      fields.length > 0
        ? appI18n.t('sync.autoMergeFields')
        : appI18n.t('sync.autoMergeVersionOnly'),
    status: 'requeued',
  };
}

export function canAutoMergePushResult(result: PushSyncResult) {
  return result.code === 'conflict_remote_newer';
}

export function isGraphEntityType(entityType: SyncEntityType) {
  return (
    entityType === 'series' ||
    entityType === 'contributor' ||
    entityType === 'work_series_link' ||
    entityType === 'work_contributor' ||
    entityType === 'work_relation'
  );
}

export function isTierBoardEntityType(entityType: SyncEntityType) {
  return (
    entityType === 'tier_board' ||
    entityType === 'tier_lane' ||
    entityType === 'tier_board_card' ||
    entityType === 'tier_board_asset'
  );
}

export function getRemoteConflictPayload(result: PushSyncResult) {
  if (result.entityType === 'release_record') {
    return result.releaseRecord ?? null;
  }

  if (result.entityType === 'timeline_entry') {
    return result.timelineEntry ?? null;
  }

  if (result.entityType === 'series') {
    return result.series ?? null;
  }

  if (result.entityType === 'contributor') {
    return result.contributor ?? null;
  }

  if (result.entityType === 'work_series_link') {
    return result.workSeriesLink ?? null;
  }

  if (result.entityType === 'work_contributor') {
    return result.workContributor ?? null;
  }

  if (result.entityType === 'work_relation') {
    return result.workRelation ?? null;
  }

  if (result.entityType === 'tier_board') {
    return result.tierBoard ?? null;
  }

  if (result.entityType === 'tier_lane') {
    return result.tierLane ?? null;
  }

  if (result.entityType === 'tier_board_card') {
    return result.tierBoardCard ?? null;
  }

  if (result.entityType === 'tier_board_asset') {
    return result.tierBoardAsset ?? null;
  }

  return result.work ?? null;
}

export function getRemotePullConflictPayload(change: PullSyncChange) {
  if (change.entityType === 'release_record') {
    return change.releaseRecord ?? null;
  }

  if (change.entityType === 'timeline_entry') {
    return change.timelineEntry ?? null;
  }

  if (change.entityType === 'series') {
    return change.series ?? null;
  }

  if (change.entityType === 'contributor') {
    return change.contributor ?? null;
  }

  if (change.entityType === 'work_series_link') {
    return change.workSeriesLink ?? null;
  }

  if (change.entityType === 'work_contributor') {
    return change.workContributor ?? null;
  }

  if (change.entityType === 'work_relation') {
    return change.workRelation ?? null;
  }

  if (change.entityType === 'tier_board') {
    return change.tierBoard ?? null;
  }

  if (change.entityType === 'tier_lane') {
    return change.tierLane ?? null;
  }

  if (change.entityType === 'tier_board_card') {
    return change.tierBoardCard ?? null;
  }

  if (change.entityType === 'tier_board_asset') {
    return change.tierBoardAsset ?? null;
  }

  return change.work ?? null;
}

export class SyncAutoMergeService {
  mergeWorkSafely(
    remote: WorkRecord,
    localPayload: WorkRecord,
  ): AutoMergeOutcome<WorkRecord> {
    if (remote.id !== localPayload.id) {
      return { ok: false, reason: 'entity_mismatch' };
    }

    if (hasDeleteUpdateCollision(remote, localPayload)) {
      return { ok: false, reason: 'delete_update_collision' };
    }

    const scalarFields = [
      'catalogTitleId',
      'importDraft',
      'type',
      'title',
      'author',
      'description',
      'thumbnailUrl',
      'status',
      'rating',
      'shortReview',
      'review',
      'favorite',
      'progressCurrent',
      'progressTotal',
      'progressUnit',
      'lastConsumedLabel',
      'startedAt',
      'completedAt',
      'droppedAt',
      'lastConsumedAt',
    ] as const satisfies readonly (keyof WorkRecord)[];

    if (!haveSameFieldValues(remote, localPayload, scalarFields)) {
      return { ok: false, reason: 'overlapping_field_change' };
    }

    const taxonomy = moveUnknownGenresToPersonalTags(
      mergeUniqueValues(remote.genres, localPayload.genres),
      mergeUniqueValues(remote.personalTags, localPayload.personalTags),
    );

    return {
      ok: true,
      merged: {
        ...cloneWorkRecord(localPayload),
        createdAt: remote.createdAt,
        deletedAt: null,
        genres: taxonomy.genres,
        personalTags: taxonomy.personalTags,
        serverVersion: remote.serverVersion,
        syncStatus: 'pending',
        updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
      },
      mergedFields: ['genres', 'personalTags'],
    };
  }

  mergeReleaseRecordSafely(
    remote: UserReleaseRecord,
    localPayload: UserReleaseRecord,
  ): AutoMergeOutcome<UserReleaseRecord> {
    if (
      remote.id !== localPayload.id ||
      remote.userWorkRecordId !== localPayload.userWorkRecordId ||
      remote.catalogReleaseId !== localPayload.catalogReleaseId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (hasDeleteUpdateCollision(remote, localPayload)) {
      return { ok: false, reason: 'delete_update_collision' };
    }

    const fields = [
      'status',
      'rating',
      'shortReview',
      'review',
      'favorite',
    ] as const satisfies readonly (keyof UserReleaseRecord)[];

    if (!haveSameFieldValues(remote, localPayload, fields)) {
      return { ok: false, reason: 'overlapping_field_change' };
    }

    return {
      ok: true,
      merged: {
        ...cloneReleaseRecord(localPayload),
        createdAt: remote.createdAt,
        serverVersion: remote.serverVersion,
        syncStatus: 'pending',
        updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
      },
      mergedFields: [],
    };
  }

  mergeTimelineEntrySafely(
    remote: TimelineEntryRecord,
    localPayload: TimelineEntryRecord,
  ): AutoMergeOutcome<TimelineEntryRecord> {
    if (
      remote.id !== localPayload.id ||
      remote.workId !== localPayload.workId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (hasDeleteUpdateCollision(remote, localPayload)) {
      return { ok: false, reason: 'delete_update_collision' };
    }

    const fields = [
      'type',
      'occurredAt',
      'note',
      'source',
    ] as const satisfies readonly (keyof TimelineEntryRecord)[];

    if (!haveSameFieldValues(remote, localPayload, fields)) {
      return { ok: false, reason: 'overlapping_field_change' };
    }

    return {
      ok: true,
      merged: {
        ...cloneTimelineEntry(localPayload),
        createdAt: remote.createdAt,
        serverVersion: remote.serverVersion,
        syncStatus: 'pending',
        updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
      },
      mergedFields: [],
    };
  }

  mergeGraphEntitySafely<TRecord extends GraphEntityRecord>(
    remote: TRecord,
    localPayload: TRecord,
  ): AutoMergeOutcome<TRecord> {
    if (remote.id !== localPayload.id) {
      return { ok: false, reason: 'entity_mismatch' };
    }

    if (hasDeleteUpdateCollision(remote, localPayload)) {
      return { ok: false, reason: 'delete_update_collision' };
    }

    if (
      'parentId' in remote &&
      remote.parentId !== (localPayload as SeriesRecord).parentId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (
      'workId' in remote &&
      remote.workId !==
        (localPayload as WorkSeriesLinkRecord | WorkContributorRecord).workId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (
      'sourceWorkId' in remote &&
      (remote.sourceWorkId !==
        (localPayload as WorkRelationRecord).sourceWorkId ||
        remote.targetWorkId !==
          (localPayload as WorkRelationRecord).targetWorkId)
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    const mergedFields: string[] = [];
    let scalarFields: readonly string[];

    if ('aliases' in remote) {
      scalarFields =
        'kind' in remote
          ? [
              'title',
              'normalizedTitle',
              'kind',
              'parentId',
              'description',
              'thumbnailUrl',
            ]
          : ['name', 'normalizedName', 'entityType'];
      mergedFields.push('aliases');
    } else if ('seriesId' in remote) {
      scalarFields = ['workId', 'seriesId', 'role', 'orderIndex', 'orderLabel'];
    } else if ('contributorId' in remote) {
      scalarFields = ['workId', 'contributorId', 'role', 'displayOrder'];
    } else {
      scalarFields = ['sourceWorkId', 'targetWorkId', 'relationType', 'note'];
    }

    if (
      !scalarFields.every((field) =>
        areEqual(
          (remote as unknown as Record<string, unknown>)[field],
          (localPayload as unknown as Record<string, unknown>)[field],
        ),
      )
    ) {
      return { ok: false, reason: 'overlapping_field_change' };
    }

    const merged = {
      ...cloneGraphEntity(localPayload),
      createdAt: remote.createdAt,
      serverVersion: remote.serverVersion,
      syncStatus: 'pending',
      updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
      ...('aliases' in remote
        ? {
            aliases: mergeUniqueValues(
              remote.aliases,
              (localPayload as ContributorRecord | SeriesRecord).aliases,
            ),
          }
        : {}),
    } as TRecord;

    return {
      ok: true,
      merged,
      mergedFields,
    };
  }

  mergeTierBoardEntitySafely<TRecord extends TierBoardEntityRecord>(
    remote: TRecord,
    localPayload: TRecord,
  ): AutoMergeOutcome<TRecord> {
    if (remote.id !== localPayload.id) {
      return { ok: false, reason: 'entity_mismatch' };
    }

    if (hasDeleteUpdateCollision(remote, localPayload)) {
      return { ok: false, reason: 'delete_update_collision' };
    }

    if (
      'boardId' in remote &&
      remote.boardId !==
        (
          localPayload as
            | TierLaneRecord
            | TierBoardCardRecord
            | TierBoardAssetRecord
        ).boardId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (
      'laneId' in remote &&
      remote.laneId !== (localPayload as TierBoardCardRecord).laneId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    if (
      'cardId' in remote &&
      remote.cardId !== (localPayload as TierBoardAssetRecord).cardId
    ) {
      return { ok: false, reason: 'parent_mismatch' };
    }

    const scalarFields =
      'slug' in remote
        ? [
            'title',
            'description',
            'slug',
            'boardType',
            'visibility',
            'coverImageUrl',
          ]
        : 'colorToken' in remote
          ? ['boardId', 'title', 'description', 'colorToken', 'orderIndex']
          : 'cardSourceType' in remote
            ? [
                'boardId',
                'laneId',
                'cardSourceType',
                'workId',
                'orderIndex',
                'title',
                'subtitle',
                'imageUrl',
                'note',
              ]
            : [
                'boardId',
                'cardId',
                'kind',
                'storageType',
                'objectUrl',
                'originalName',
                'mimeType',
                'sizeBytes',
              ];

    if (
      !scalarFields.every((field) =>
        areEqual(
          (remote as unknown as Record<string, unknown>)[field],
          (localPayload as unknown as Record<string, unknown>)[field],
        ),
      )
    ) {
      return { ok: false, reason: 'overlapping_field_change' };
    }

    return {
      ok: true,
      merged: {
        ...localPayload,
        createdAt: remote.createdAt,
        ...('serverVersion' in remote
          ? { serverVersion: remote.serverVersion, syncStatus: 'pending' }
          : {}),
        updatedAt: getLatestIso(remote.updatedAt, localPayload.updatedAt),
      } as TRecord,
      mergedFields: [],
    };
  }
}

export const syncAutoMergeService = new SyncAutoMergeService();
