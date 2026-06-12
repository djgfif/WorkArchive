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
  CREATED_MESSAGE,
  SYNC_CODES,
  getAppliedMutationResult,
} from './sync-push.shared';
import {
  buildRecordAppliedResult,
  buildRecordOwnershipConflict,
  buildRecordParentConflict,
  buildRecordValidationFailure,
  getMissingRemoteRecordResult,
} from './sync-push.record-results';
import { validateTimelineEntryTarget } from './sync-push.record-validation';

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
    return buildRecordOwnershipConflict(
      change,
      'timelineEntry',
      'Server mismatch: the timeline entry cannot be modified remotely.',
    );
  }

  if (existing.userWorkRecordId !== payload.workId) {
    return buildRecordParentConflict(
      change,
      'timelineEntry',
      'Server mismatch: timeline entry parent changed.',
      {
        timelineEntry: toUserTimelineEntryResponse(existing),
      },
    );
  }

  const validationError = await validateTimelineEntryTarget(
    userId,
    payload,
    dependencies,
  );

  if (validationError) {
    return buildRecordValidationFailure(
      change,
      'timelineEntry',
      validationError,
      {
        timelineEntry: toUserTimelineEntryResponse(existing),
      },
    );
  }

  if (areTimelineEntriesEquivalent(existing, payload)) {
    return buildRecordAppliedResult(change, 'timelineEntry', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      timelineEntry: toUserTimelineEntryResponse(existing),
    });
  }

  const updated = await dependencies.timelineEntriesService.update(
    change.entityId,
    buildTimelineEntryUpdateData(payload),
    client,
  );

  return buildRecordAppliedResult(change, 'timelineEntry', {
    ...getAppliedMutationResult(payload.deletedAt),
    timelineEntry: toUserTimelineEntryResponse(updated),
  });
}

async function applyMissingRemoteTimelineEntryChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTimelineEntryPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushTimelineEntryDependencies,
): Promise<PushSyncResultDto> {
  const missingRemoteResult = getMissingRemoteRecordResult(
    change,
    'timelineEntry',
    payload,
    {
      deletedSyncedConflict:
        'Server mismatch: the timeline entry was already missing remotely.',
      missingConflict:
        'Server mismatch: the timeline entry does not exist remotely.',
    },
  );

  if (missingRemoteResult) {
    return missingRemoteResult;
  }

  const validationError = await validateTimelineEntryTarget(
    userId,
    payload,
    dependencies,
  );

  if (validationError) {
    return buildRecordValidationFailure(
      change,
      'timelineEntry',
      validationError,
      {},
    );
  }

  const created = await dependencies.timelineEntriesService.create(
    buildTimelineEntryCreateData(userId, payload),
    client,
  );

  return buildRecordAppliedResult(change, 'timelineEntry', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    timelineEntry: toUserTimelineEntryResponse(created),
  });
}
