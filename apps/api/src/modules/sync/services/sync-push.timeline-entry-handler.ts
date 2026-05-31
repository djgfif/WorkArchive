import type { Prisma } from '@prisma/client';

import type { UserRecordsService } from '../../user-records/user-records.service';
import {
  toUserTimelineEntryResponse,
  type UserTimelineEntriesService,
} from '../../user-records/user-timeline-entries.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import {
  buildTimelineEntryCreateData,
  buildTimelineEntryUpdateData,
} from './sync-push.data-builders';
import { areTimelineEntriesEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export interface SyncPushTimelineEntryDependencies {
  timelineEntriesService: UserTimelineEntriesService;
  userRecordsService: UserRecordsService;
}

export async function applyTimelineEntryChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTimelineEntryPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushTimelineEntryDependencies,
): Promise<PushSyncResultDto> {
  const existing = await dependencies.timelineEntriesService.findById(
    change.entityId,
  );

  if (!existing) {
    return applyMissingRemoteTimelineEntryChange(
      userId,
      change,
      payload,
      client,
      dependencies,
    );
  }

  if (existing.userId !== userId) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Server mismatch: the timeline entry cannot be modified remotely.',
      timelineEntry: null,
    };
  }

  if (existing.userWorkRecordId !== payload.workId) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'conflict',
      code: SYNC_CODES.conflictParentChanged,
      message: 'Server mismatch: timeline entry parent changed.',
      timelineEntry: toUserTimelineEntryResponse(existing),
    };
  }

  const validationError = await validateTimelineEntryTarget(
    userId,
    payload,
    dependencies,
  );

  if (validationError) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: validationError,
      timelineEntry: toUserTimelineEntryResponse(existing),
    };
  }

  if (areTimelineEntriesEquivalent(existing, payload)) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'applied',
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      timelineEntry: toUserTimelineEntryResponse(existing),
    };
  }

  const updated = await dependencies.timelineEntriesService.update(
    change.entityId,
    buildTimelineEntryUpdateData(payload),
    client,
  );

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'timeline_entry',
    status: 'applied',
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    timelineEntry: toUserTimelineEntryResponse(updated),
  };
}

async function applyMissingRemoteTimelineEntryChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTimelineEntryPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushTimelineEntryDependencies,
): Promise<PushSyncResultDto> {
  const isDelete = change.operation === 'delete' || payload.deletedAt !== null;
  const canCreate = change.operation === 'create' && payload.serverVersion === 0;

  if (isDelete) {
    if (payload.serverVersion > 0) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'timeline_entry',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the timeline entry was already missing remotely.',
        timelineEntry: null,
      };
    }

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      timelineEntry: null,
    };
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Server mismatch: the timeline entry does not exist remotely.',
      timelineEntry: null,
    };
  }

  const validationError = await validateTimelineEntryTarget(
    userId,
    payload,
    dependencies,
  );

  if (validationError) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'timeline_entry',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: validationError,
      timelineEntry: null,
    };
  }

  const created = await dependencies.timelineEntriesService.create(
    buildTimelineEntryCreateData(userId, payload),
    client,
  );

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'timeline_entry',
    status: 'applied',
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    timelineEntry: toUserTimelineEntryResponse(created),
  };
}

async function validateTimelineEntryTarget(
  userId: string,
  payload: SyncTimelineEntryPayloadDto,
  dependencies: Pick<SyncPushTimelineEntryDependencies, 'userRecordsService'>,
) {
  const parent = await dependencies.userRecordsService.findById(payload.workId);

  if (!parent || parent.userId !== userId) {
    return 'Timeline entry parent is missing or belongs to a different user.';
  }

  return null;
}
