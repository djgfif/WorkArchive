import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import {
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';

type WorkResultPayload = {
  code: NonNullable<PushSyncResultDto['code']>;
  message: string;
  work: WorkResultValue;
};

type WorkResultValue = NonNullable<PushSyncResultDto['work']> | null;

export function buildWorkValidationFailure(
  change: PushSyncChangeDto,
  message: string,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'failed',
    code: SYNC_CODES.failedValidation,
    message,
    work: null,
  };
}

export function buildWorkOwnershipConflict(
  change: PushSyncChangeDto,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictOwnershipMismatch,
    message: 'Server mismatch: the record cannot be modified remotely.',
    work: null,
  };
}

export function buildWorkRemoteNewerConflict(
  change: PushSyncChangeDto,
  work: WorkResultValue,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictRemoteNewer,
    message: 'Server mismatch: the work record has a newer remote version.',
    work,
  };
}

export function buildWorkCreateFailure(
  change: PushSyncChangeDto,
  payload: Pick<WorkResultPayload, 'code' | 'message'>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'failed',
    code: payload.code,
    message: payload.message,
    work: null,
  };
}

export function buildWorkAppliedResult(
  change: PushSyncChangeDto,
  payload: WorkResultPayload,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    code: payload.code,
    message: payload.message,
    work: payload.work,
  };
}

export function getMissingRemoteWorkResult(
  change: PushSyncChangeDto,
  payload: { deletedAt: string | null; serverVersion: number },
): PushSyncResultDto | null {
  const isDelete = change.operation === 'delete' || payload.deletedAt !== null;
  const canCreate = change.operation === 'create' && payload.serverVersion === 0;

  if (isDelete) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: payload.serverVersion > 0 ? 'conflict' : 'applied',
      code:
        payload.serverVersion > 0
          ? SYNC_CODES.conflictRemoteMissing
          : SYNC_CODES.missingRemoteDeleteNoop,
      message:
        payload.serverVersion > 0
          ? 'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.'
          : MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      work: null,
    };
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Server mismatch: the record does not exist remotely anymore.',
      work: null,
    };
  }

  return null;
}
