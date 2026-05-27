import type {
  SyncEntityType,
  UserReleaseRecord,
  WorkRecord,
  WorkSyncStatus,
  TimelineEntryRecord,
} from '@work-archive/shared-types';

import {
  graphRepository,
  releaseRecordsRepository,
  timelineEntriesRepository,
  worksRepository,
  type GraphRepository,
  type ReleaseRecordsRepository,
  type TimelineEntriesRepository,
  type WorksRepository,
} from '@features/works/data';
import {
  tierBoardRepository,
  type TierBoardRepository,
} from '@features/tier-boards/data';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from './sync-queue.repository';
import {
  RELEASE_RECORD_MERGE_FIELDS,
  WORK_MERGE_FIELDS,
  cloneGraphEntity,
  cloneQueuePayload,
  cloneReleaseRecord,
  cloneTimelineEntry,
  cloneWorkRecord,
  isGraphEntityType,
  isTierBoardEntityType,
  type GraphEntityRecord,
  type ReleaseRecordConflictMergeField,
  type TierBoardEntityRecord,
  type WorkConflictMergeField,
} from './sync-auto-merge.service';

function getNowIso() {
  return new Date().toISOString();
}

export class SyncConflictResolutionService {
  constructor(
    private readonly worksRepo: WorksRepository = worksRepository,
    private readonly releaseRecordsRepo: ReleaseRecordsRepository = releaseRecordsRepository,
    private readonly queueRepo: SyncQueueRepository = syncQueueRepository,
    private readonly timelineEntriesRepo: TimelineEntriesRepository = timelineEntriesRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
    private readonly tierBoardRepo: TierBoardRepository = tierBoardRepository,
  ) {}

  async resolveConflictWithLocal(queueItemId: string) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const now = getNowIso();

    if (queueItem.entityType === 'release_record') {
      const localReleaseRecord =
        (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as UserReleaseRecord);
      const nextReleaseRecord: UserReleaseRecord = {
        ...cloneReleaseRecord(localReleaseRecord),
        syncStatus: 'pending',
        updatedAt: now,
      };

      await this.releaseRecordsRepo.update(nextReleaseRecord);
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord, {
        rotateClientMutationId: true,
      });

      return nextReleaseRecord;
    }

    if (queueItem.entityType === 'timeline_entry') {
      const localTimelineEntry =
        (await this.timelineEntriesRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as TimelineEntryRecord);
      const nextTimelineEntry: TimelineEntryRecord = {
        ...cloneTimelineEntry(localTimelineEntry),
        syncStatus: 'pending',
        updatedAt: now,
      };

      await this.timelineEntriesRepo.update(nextTimelineEntry);
      await this.queueRepo.resetForRetry(queueItem.id, nextTimelineEntry, {
        rotateClientMutationId: true,
      });

      return nextTimelineEntry;
    }

    if (isGraphEntityType(queueItem.entityType)) {
      const localGraphEntity =
        ((await this.graphRepo.getEntity(
          queueItem.entityType,
          queueItem.entityId,
        )) as GraphEntityRecord | null) ??
        (queueItem.payload as GraphEntityRecord);
      const nextGraphEntity = {
        ...cloneGraphEntity(localGraphEntity),
        syncStatus: 'pending',
        updatedAt: now,
      } as GraphEntityRecord;

      await this.graphRepo.putEntity(nextGraphEntity);
      await this.queueRepo.resetForRetry(queueItem.id, nextGraphEntity, {
        rotateClientMutationId: true,
      });

      return nextGraphEntity;
    }

    if (isTierBoardEntityType(queueItem.entityType)) {
      const localTierBoardEntity =
        ((await this.tierBoardRepo.getEntity(
          queueItem.entityType,
          queueItem.entityId,
        )) as TierBoardEntityRecord | null) ??
        (queueItem.payload as TierBoardEntityRecord);
      const nextTierBoardEntity = {
        ...localTierBoardEntity,
        ...('syncStatus' in localTierBoardEntity
          ? { syncStatus: 'pending' as const }
          : {}),
        updatedAt: now,
      } as TierBoardEntityRecord;

      await this.tierBoardRepo.putEntity(nextTierBoardEntity);
      await this.queueRepo.resetForRetry(queueItem.id, nextTierBoardEntity, {
        rotateClientMutationId: true,
      });

      return nextTierBoardEntity;
    }

    const localWork =
      (await this.worksRepo.getById(queueItem.entityId)) ??
      (queueItem.payload as WorkRecord);
    const nextWork: WorkRecord = {
      ...cloneWorkRecord(localWork),
      syncStatus: 'pending',
      updatedAt: now,
    };

    await this.worksRepo.update(nextWork);
    await this.queueRepo.resetForRetry(queueItem.id, nextWork, {
      rotateClientMutationId: true,
    });

    return nextWork;
  }

  async resolveConflictWithRemote(queueItemId: string) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const remote = queueItem.conflict?.remote ?? null;

    if (!remote) {
      throw new Error('원격 스냅샷이 없어 원격 기록을 적용할 수 없습니다.');
    }

    if (queueItem.entityType === 'release_record') {
      const remoteReleaseRecord: UserReleaseRecord = {
        ...cloneReleaseRecord(remote as UserReleaseRecord),
        syncStatus: 'synced',
      };

      await this.releaseRecordsRepo.update(remoteReleaseRecord);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteReleaseRecord;
    }

    if (queueItem.entityType === 'timeline_entry') {
      const remoteTimelineEntry: TimelineEntryRecord = {
        ...cloneTimelineEntry(remote as TimelineEntryRecord),
        syncStatus: 'synced',
      };

      await this.timelineEntriesRepo.update(remoteTimelineEntry);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteTimelineEntry;
    }

    if (isGraphEntityType(queueItem.entityType)) {
      const remoteGraphEntity = {
        ...cloneGraphEntity(remote as GraphEntityRecord),
        syncStatus: 'synced',
      } as GraphEntityRecord;

      await this.graphRepo.putEntity(remoteGraphEntity);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteGraphEntity;
    }

    if (isTierBoardEntityType(queueItem.entityType)) {
      const remoteTierBoardEntity = {
        ...(remote as TierBoardEntityRecord),
        ...('syncStatus' in (remote as TierBoardEntityRecord)
          ? { syncStatus: 'synced' as const }
          : {}),
      } as TierBoardEntityRecord;

      await this.tierBoardRepo.putEntity(remoteTierBoardEntity);
      await this.queueRepo.removeMany([queueItem.id]);

      return remoteTierBoardEntity;
    }

    const remoteWork: WorkRecord = {
      ...cloneWorkRecord(remote as WorkRecord),
      syncStatus: 'synced',
    };

    await this.worksRepo.update(remoteWork);
    await this.queueRepo.removeMany([queueItem.id]);

    return remoteWork;
  }

  async resolveConflictWithMergedFields(
    queueItemId: string,
    remoteFields: readonly string[],
  ) {
    const queueItem = await this.queueRepo.getById(queueItemId);

    if (!queueItem) {
      throw new Error('해결할 동기화 항목을 찾지 못했습니다.');
    }

    const remote = queueItem.conflict?.remote ?? null;

    if (!remote) {
      throw new Error('원격 스냅샷이 없어 필드별 병합을 할 수 없습니다.');
    }

    const now = getNowIso();

    if (queueItem.entityType === 'release_record') {
      const selectedFields = new Set<keyof UserReleaseRecord>(
        remoteFields.filter((field): field is ReleaseRecordConflictMergeField =>
          (RELEASE_RECORD_MERGE_FIELDS as readonly string[]).includes(field),
        ),
      );
      const localReleaseRecord =
        (await this.releaseRecordsRepo.getById(queueItem.entityId)) ??
        (queueItem.payload as UserReleaseRecord);
      const nextReleaseRecord = cloneReleaseRecord(localReleaseRecord);
      const remoteReleaseRecord = remote as UserReleaseRecord;

      for (const field of selectedFields) {
        nextReleaseRecord[field] = remoteReleaseRecord[field] as never;
      }

      nextReleaseRecord.syncStatus = 'pending';
      nextReleaseRecord.updatedAt = now;

      await this.releaseRecordsRepo.update(nextReleaseRecord);
      await this.queueRepo.resetForRetry(queueItem.id, nextReleaseRecord, {
        rotateClientMutationId: true,
      });

      return nextReleaseRecord;
    }

    if (
      queueItem.entityType === 'timeline_entry' ||
      isGraphEntityType(queueItem.entityType) ||
      isTierBoardEntityType(queueItem.entityType)
    ) {
      return this.resolveConflictWithLocal(queueItemId);
    }

    const selectedFields = new Set<keyof WorkRecord>(
      remoteFields.filter((field): field is WorkConflictMergeField =>
        (WORK_MERGE_FIELDS as readonly string[]).includes(field),
      ),
    );
    const localWork =
      (await this.worksRepo.getById(queueItem.entityId)) ??
      (queueItem.payload as WorkRecord);
    const nextWork = cloneWorkRecord(localWork);
    const remoteWork = remote as WorkRecord;

    for (const field of selectedFields) {
      nextWork[field] = cloneQueuePayload(remoteWork)[field] as never;
    }

    nextWork.syncStatus = 'pending';
    nextWork.updatedAt = now;

    await this.worksRepo.update(nextWork);
    await this.queueRepo.resetForRetry(queueItem.id, nextWork, {
      rotateClientMutationId: true,
    });

    return nextWork;
  }

  markEntitySyncStatus(
    entityType: SyncEntityType,
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    if (entityType === 'work') {
      return this.markWorkSyncStatus(id, syncStatus);
    }

    if (entityType === 'release_record') {
      return this.markReleaseRecordSyncStatus(id, syncStatus);
    }

    if (entityType === 'timeline_entry') {
      return this.markTimelineEntrySyncStatus(id, syncStatus);
    }

    if (isTierBoardEntityType(entityType)) {
      return this.tierBoardRepo.markSyncStatus(entityType, id, syncStatus);
    }

    return this.graphRepo.markSyncStatus(entityType, id, syncStatus);
  }

  private async markWorkSyncStatus(id: string, syncStatus: WorkSyncStatus) {
    const work = await this.worksRepo.getById(id);

    if (!work || work.syncStatus === syncStatus) {
      return;
    }

    await this.worksRepo.update({
      ...work,
      syncStatus,
    });
  }

  private async markReleaseRecordSyncStatus(
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    const releaseRecord = await this.releaseRecordsRepo.getById(id);

    if (!releaseRecord || releaseRecord.syncStatus === syncStatus) {
      return;
    }

    await this.releaseRecordsRepo.update({
      ...releaseRecord,
      syncStatus,
    });
  }

  private async markTimelineEntrySyncStatus(
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    const timelineEntry = await this.timelineEntriesRepo.getById(id);

    if (!timelineEntry || timelineEntry.syncStatus === syncStatus) {
      return;
    }

    await this.timelineEntriesRepo.update({
      ...timelineEntry,
      syncStatus,
    });
  }
}

export const syncConflictResolutionService = new SyncConflictResolutionService();
