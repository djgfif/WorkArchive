import type { Prisma } from '@prisma/client';

import { canCreateReleaseRecord } from '../../recording/recording-policy';
import {
  USER_RELEASE_RECORD_INCLUDE,
  toUserReleaseRecordResponse,
  type UserReleaseRecordsService,
} from '../../user-records/user-release-records.service';
import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import {
  buildReleaseRecordCreateData,
  buildReleaseRecordUpdateData,
} from './sync-push.data-builders';
import { areReleaseRecordsEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export interface SyncPushReleaseRecordDependencies {
  releaseRecordsService: UserReleaseRecordsService;
  userRecordsService: UserRecordsService;
}

export async function applyReleaseRecordChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushReleaseRecordDependencies,
): Promise<PushSyncResultDto> {
  const existing = await dependencies.releaseRecordsService.findById(
    change.entityId,
  );

  if (!existing) {
    return applyMissingRemoteReleaseRecordChange(
      userId,
      change,
      payload,
      client,
      dependencies,
    );
  }

  if (existing.userWorkRecord.userId !== userId) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Server mismatch: the release record cannot be modified remotely.',
      releaseRecord: null,
    };
  }

  if (
    existing.userWorkRecordId !== payload.userWorkRecordId ||
    existing.catalogReleaseId !== payload.catalogReleaseId
  ) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'conflict',
      code: SYNC_CODES.conflictParentChanged,
      message: 'Server mismatch: release record parent or release changed.',
      releaseRecord: toUserReleaseRecordResponse(existing),
    };
  }

  const validationError = await validateReleaseRecordTarget(
    userId,
    payload,
    client,
    dependencies,
  );

  if (validationError) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: validationError,
      releaseRecord: toUserReleaseRecordResponse(existing),
    };
  }

  if (areReleaseRecordsEquivalent(existing, payload)) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'applied',
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      releaseRecord: toUserReleaseRecordResponse(existing),
    };
  }

  const updated = await dependencies.releaseRecordsService.update(
    change.entityId,
    buildReleaseRecordUpdateData(payload),
    client,
  );

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'release_record',
    status: 'applied',
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    releaseRecord: toUserReleaseRecordResponse(updated),
  };
}

async function applyMissingRemoteReleaseRecordChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushReleaseRecordDependencies,
): Promise<PushSyncResultDto> {
  const isDelete = change.operation === 'delete' || payload.deletedAt !== null;
  const canCreate = change.operation === 'create' && payload.serverVersion === 0;

  if (isDelete) {
    if (payload.serverVersion > 0) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'release_record',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message: 'Server mismatch: the release record was already missing remotely.',
        releaseRecord: null,
      };
    }

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      releaseRecord: null,
    };
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Server mismatch: the release record does not exist remotely.',
      releaseRecord: null,
    };
  }

  const validationError = await validateReleaseRecordTarget(
    userId,
    payload,
    client,
    dependencies,
  );

  if (validationError) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'release_record',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: validationError,
      releaseRecord: null,
    };
  }

  const created = await client.userReleaseRecord.create({
    data: buildReleaseRecordCreateData(payload),
    include: USER_RELEASE_RECORD_INCLUDE,
  });
  const hydrated =
    created.createdAt instanceof Date
      ? created
      : await dependencies.releaseRecordsService.findById(created.id);

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'release_record',
    status: 'applied',
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    releaseRecord: hydrated ? toUserReleaseRecordResponse(hydrated) : null,
  };
}

async function validateReleaseRecordTarget(
  userId: string,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: Pick<SyncPushReleaseRecordDependencies, 'userRecordsService'>,
) {
  const parent = await dependencies.userRecordsService.findById(
    payload.userWorkRecordId,
  );

  if (!parent || parent.userId !== userId) {
    return 'Release record parent is missing or belongs to a different user.';
  }

  const mediumType = parent.catalogTitle?.mediumType ?? parent.catalogWork.type;

  if (!canCreateReleaseRecord(mediumType)) {
    return `Release-level records are not supported for medium type "${mediumType}".`;
  }

  if (!parent.catalogTitleId) {
    return 'Release-level records require a catalog title bridge.';
  }

  const release = await client.catalogRelease.findFirst({
    where: {
      id: payload.catalogReleaseId,
      catalogTitleId: parent.catalogTitleId,
    },
  });

  if (!release) {
    return 'Catalog release does not belong to the parent catalog title.';
  }

  return null;
}
