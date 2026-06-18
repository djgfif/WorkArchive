import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import {
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';

type RecordPayloadKey = 'releaseRecord' | 'timelineEntry';

type RecordResultPayload = Partial<PushSyncResultDto> &
  Pick<PushSyncResultDto, 'code' | 'message'>;

export function buildRecordOwnershipConflict(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
  message: string,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictOwnershipMismatch,
    message,
    [key]: null,
  } as PushSyncResultDto;
}

export function buildRecordParentConflict(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
  message: string,
  payload: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictParentChanged,
    message,
    ...payload,
    [key]: payload[key] ?? null,
  } as PushSyncResultDto;
}

export function buildRecordRemoteNewerConflict(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
  message: string,
  payload: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictRemoteNewer,
    message,
    ...payload,
    [key]: payload[key] ?? null,
  } as PushSyncResultDto;
}

export function buildRecordValidationFailure(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
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
  } as PushSyncResultDto;
}

export function buildRecordAppliedResult(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
  payload: RecordResultPayload,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    ...payload,
    [key]: payload[key] ?? null,
  } as PushSyncResultDto;
}

export function getMissingRemoteRecordResult(
  change: PushSyncChangeDto,
  key: RecordPayloadKey,
  payload: { deletedAt: string | null; serverVersion: number },
  messages: {
    deletedSyncedConflict: string;
    missingConflict: string;
  },
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
          ? messages.deletedSyncedConflict
          : MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      [key]: null,
    } as PushSyncResultDto;
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: messages.missingConflict,
      [key]: null,
    } as PushSyncResultDto;
  }

  return null;
}
