import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  buildWorkContributorCreateData,
  buildWorkContributorUpdateData,
  buildWorkRelationCreateData,
  buildWorkRelationUpdateData,
  buildWorkSeriesLinkCreateData,
  buildWorkSeriesLinkUpdateData,
} from './sync-push.data-builders';
import {
  areWorkContributorsEquivalent,
  areWorkRelationsEquivalent,
  areWorkSeriesLinksEquivalent,
} from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  USER_WORK_CONTRIBUTOR_INCLUDE,
  USER_WORK_RELATION_INCLUDE,
  USER_WORK_SERIES_LINK_INCLUDE,
} from './sync-push.shared';
import {
  toPushSyncWorkContributorPayload,
  toPushSyncWorkRelationPayload,
  toPushSyncWorkSeriesLinkPayload,
} from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphParentChangedConflict,
  buildGraphRemoteNewerConflict,
  buildGraphValidationFailure,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';
import {
  validateWorkContributorTarget,
  validateWorkRelationTarget,
  validateWorkSeriesLinkTarget,
} from './sync-push.graph-validation';

export async function applyWorkSeriesLinkChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkSeriesLinkPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const existing = await client.userWorkSeriesLink.findUnique({
    where: { id: change.entityId },
    include: USER_WORK_SERIES_LINK_INCLUDE,
  });

  if (!existing) {
    return applyMissingRemoteWorkSeriesLinkChange(
      userId,
      change,
      payload,
      client,
      userRecordsService,
    );
  }

  if (
    existing.userWork.userId !== userId ||
    existing.userSeries.userId !== userId
  ) {
    return buildGraphOwnershipConflict(change, 'workSeriesLink');
  }

  if (
    existing.userWorkId !== payload.workId ||
    existing.userSeriesId !== payload.seriesId
  ) {
    return buildGraphParentChangedConflict(change, 'workSeriesLink', {
      workSeriesLink: toPushSyncWorkSeriesLinkPayload(existing),
    });
  }

  const validationError = await validateWorkSeriesLinkTarget(
    userId,
    payload,
    client,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(
      change,
      'workSeriesLink',
      validationError,
      { workSeriesLink: toPushSyncWorkSeriesLinkPayload(existing) },
    );
  }

  if (
    existing.serverVersion > payload.serverVersion &&
    !areWorkSeriesLinksEquivalent(existing, payload)
  ) {
    return buildGraphRemoteNewerConflict(change, 'workSeriesLink', {
      workSeriesLink: toPushSyncWorkSeriesLinkPayload(existing),
    });
  }

  if (areWorkSeriesLinksEquivalent(existing, payload)) {
    return buildGraphAppliedResult(change, 'workSeriesLink', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      workSeriesLink: toPushSyncWorkSeriesLinkPayload(existing),
    });
  }

  const updated = await client.userWorkSeriesLink.update({
    where: { id: change.entityId },
    data: buildWorkSeriesLinkUpdateData(payload),
    include: USER_WORK_SERIES_LINK_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workSeriesLink', {
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    workSeriesLink: toPushSyncWorkSeriesLinkPayload(updated),
  });
}

export async function applyWorkContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkContributorPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const existing = await client.userWorkContributor.findUnique({
    where: { id: change.entityId },
    include: USER_WORK_CONTRIBUTOR_INCLUDE,
  });

  if (!existing) {
    return applyMissingRemoteWorkContributorChange(
      userId,
      change,
      payload,
      client,
      userRecordsService,
    );
  }

  if (
    existing.userWork.userId !== userId ||
    existing.userContributor.userId !== userId
  ) {
    return buildGraphOwnershipConflict(change, 'workContributor');
  }

  if (
    existing.userWorkId !== payload.workId ||
    existing.userContributorId !== payload.contributorId
  ) {
    return buildGraphParentChangedConflict(change, 'workContributor', {
      workContributor: toPushSyncWorkContributorPayload(existing),
    });
  }

  const validationError = await validateWorkContributorTarget(
    userId,
    payload,
    client,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(
      change,
      'workContributor',
      validationError,
      { workContributor: toPushSyncWorkContributorPayload(existing) },
    );
  }

  if (
    existing.serverVersion > payload.serverVersion &&
    !areWorkContributorsEquivalent(existing, payload)
  ) {
    return buildGraphRemoteNewerConflict(change, 'workContributor', {
      workContributor: toPushSyncWorkContributorPayload(existing),
    });
  }

  if (areWorkContributorsEquivalent(existing, payload)) {
    return buildGraphAppliedResult(change, 'workContributor', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      workContributor: toPushSyncWorkContributorPayload(existing),
    });
  }

  const updated = await client.userWorkContributor.update({
    where: { id: change.entityId },
    data: buildWorkContributorUpdateData(payload),
    include: USER_WORK_CONTRIBUTOR_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workContributor', {
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    workContributor: toPushSyncWorkContributorPayload(updated),
  });
}

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
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    workRelation: toPushSyncWorkRelationPayload(updated),
  });
}

async function applyMissingRemoteWorkSeriesLinkChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkSeriesLinkPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, payload);
  if (missingResult) return missingResult;

  const validationError = await validateWorkSeriesLinkTarget(
    userId,
    payload,
    client,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(
      change,
      'workSeriesLink',
      validationError,
      { workSeriesLink: null },
    );
  }

  const created = await client.userWorkSeriesLink.create({
    data: buildWorkSeriesLinkCreateData(payload),
    include: USER_WORK_SERIES_LINK_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workSeriesLink', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    workSeriesLink: toPushSyncWorkSeriesLinkPayload(created),
  });
}

async function applyMissingRemoteWorkContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkContributorPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, payload);
  if (missingResult) return missingResult;

  const validationError = await validateWorkContributorTarget(
    userId,
    payload,
    client,
    userRecordsService,
  );
  if (validationError) {
    return buildGraphValidationFailure(
      change,
      'workContributor',
      validationError,
      { workContributor: null },
    );
  }

  const created = await client.userWorkContributor.create({
    data: buildWorkContributorCreateData(payload),
    include: USER_WORK_CONTRIBUTOR_INCLUDE,
  });

  return buildGraphAppliedResult(change, 'workContributor', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    workContributor: toPushSyncWorkContributorPayload(created),
  });
}

async function applyMissingRemoteWorkRelationChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkRelationPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, payload);
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
