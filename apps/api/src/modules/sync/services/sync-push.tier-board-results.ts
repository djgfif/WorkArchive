import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';

type TierBoardPayloadKey =
  | 'tierBoard'
  | 'tierBoardAsset'
  | 'tierBoardCard'
  | 'tierLane';

export function buildTierBoardOwnershipConflict(
  change: PushSyncChangeDto,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictOwnershipMismatch,
    message: 'Server mismatch: the tier board entity belongs to another user.',
  };
}

export function buildTierBoardParentConflict(
  change: PushSyncChangeDto,
  key: TierBoardPayloadKey,
  message = 'Parent tier board entity is missing or belongs to another user.',
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictParentChanged,
    message,
    [key]: null,
  } as PushSyncResultDto;
}

export function buildTierBoardDeleteNoop(
  change: PushSyncChangeDto,
  key: TierBoardPayloadKey,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    code: SYNC_CODES.missingRemoteDeleteNoop,
    message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
    [key]: null,
  } as PushSyncResultDto;
}

export function buildTierBoardRemoteNewerConflict(
  change: PushSyncChangeDto,
  key: TierBoardPayloadKey,
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

export function buildTierBoardAppliedResult(
  change: PushSyncChangeDto,
  data: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    message: APPLIED_CHANGE_MESSAGE,
    ...data,
  } as PushSyncResultDto;
}
