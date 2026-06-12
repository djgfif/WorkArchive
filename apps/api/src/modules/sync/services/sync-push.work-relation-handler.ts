import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import {
  buildWorkRelationCreateData,
  buildWorkRelationUpdateData,
} from './sync-push.data-builders';
import { areWorkRelationsEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  USER_WORK_RELATION_INCLUDE,
  getAppliedMutationResult,
} from './sync-push.shared';
import { toPushSyncWorkRelationPayload } from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphParentChangedConflict,
  buildGraphRemoteNewerConflict,
  buildGraphValidationFailure,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';
import { validateWorkRelationTarget } from './sync-push.graph-validation';

export async function applyWorkRelationChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkRelationPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const existing = await client.userWorkRelation.findUnique({
    where: { id: change.entityId },
    include: USER_WORK_RELATION_INCLUDE,
  });

  if (!existing) {
    return applyMissingRemoteWorkRelationChange(
      userId,
      change,
      payload,
      client,
      userRecordsService,
    );
  }

  if (
    existing.userId !== userId ||
    existing.sourceWork.userId !== userId ||
    existing.targetWork.userId !== userId
  ) {
    return buildGraphOwnershipConflict(change, 'workRelation');
  }

  if (
    existing.sourceWorkId !== payload.sourceWorkId ||
    existing.targetWorkId !== payload.targetWorkId
  ) {
    return buildGraphParentChangedConflict(change, 'workRelation', {
      workRelation: toPushSyncWorkRelationPayload(existing),
    });
  }

  const validationError = await validateWorkRelationTarget(
    userId,
    payload,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(
      change,
      'workRelation',
      validationError,
      { workRelation: toPushSyncWorkRelationPayload(existing) },
    );
  }

  if (
    existing.serverVersion > payload.serverVersion &&
    !areWorkRelationsEquivalent(existing, payload)
  ) {
    return buildGraphRemoteNewerConflict(change, 'workRelation', {
      workRelation: toPushSyncWorkRelationPayload(existing),
    });
  }

  if (areWorkRelationsEquivalent(existing, payload)) {
    return buildGraphAppliedResult(change, 'workRelation', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      workRelation: toPushSyncWorkRelationPayload(existing),
    });
  }

  const updated = await client.userWorkRelation.update({
    where: { id: change.entityId },
    data: buildWorkRelationUpdateData(payload),
    include: USER_WORK_RELATION_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workRelation', {
    ...getAppliedMutationResult(payload.deletedAt),
    workRelation: toPushSyncWorkRelationPayload(updated),
  });
}

async function applyMissingRemoteWorkRelationChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkRelationPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(
    change,
    'workRelation',
    payload,
  );
  if (missingResult) return missingResult;

  const validationError = await validateWorkRelationTarget(
    userId,
    payload,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(change, 'workRelation', validationError, {
      workRelation: null,
    });
  }

  const created = await client.userWorkRelation.create({
    data: buildWorkRelationCreateData(userId, payload),
    include: USER_WORK_RELATION_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workRelation', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    workRelation: toPushSyncWorkRelationPayload(created),
  });
}
