import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import {
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
  type GraphPayloadKey,
} from './sync-push.shared';

export function getMissingRemoteGraphResult(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
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
          ? 'Server mismatch: the graph record was already missing remotely.'
          : MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      [key]: null,
    };
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Server mismatch: the graph record does not exist remotely.',
      [key]: null,
    };
  }

  return null;
}

export function buildGraphOwnershipConflict(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictOwnershipMismatch,
    message: 'Server mismatch: the graph record belongs to a different user.',
    [key]: null,
  };
}

export function buildGraphParentChangedConflict(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
  payload: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictParentChanged,
    message: 'Server mismatch: graph record parent changed.',
    ...payload,
    [key]: payload[key] ?? null,
  };
}

export function buildGraphRemoteNewerConflict(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
  payload: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictRemoteNewer,
    message: 'Server mismatch: the graph record has a newer remote version.',
    ...payload,
    [key]: payload[key] ?? null,
  };
}

export function buildGraphValidationFailure(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
  message: string,
  payload: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'failed',
    code: SYNC_CODES.failedValidation,
    message,
    ...payload,
    [key]: payload[key] ?? null,
  };
}

export function buildGraphAppliedResult(
  change: PushSyncChangeDto,
  key: GraphPayloadKey,
  payload: Partial<PushSyncResultDto> &
    Pick<PushSyncResultDto, 'code' | 'message'>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    ...payload,
    [key]: payload[key] ?? null,
  };
}
