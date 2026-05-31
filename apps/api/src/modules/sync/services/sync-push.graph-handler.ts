import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../../prisma/prisma.service';
import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  buildContributorCreateData,
  buildContributorUpdateData,
  buildSeriesCreateData,
  buildSeriesUpdateData,
  buildWorkContributorCreateData,
  buildWorkContributorUpdateData,
  buildWorkRelationCreateData,
  buildWorkRelationUpdateData,
  buildWorkSeriesLinkCreateData,
  buildWorkSeriesLinkUpdateData,
} from './sync-push.data-builders';
import {
  areContributorsEquivalent,
  areSeriesEquivalent,
  areWorkContributorsEquivalent,
  areWorkRelationsEquivalent,
  areWorkSeriesLinksEquivalent,
} from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
  USER_WORK_CONTRIBUTOR_INCLUDE,
  USER_WORK_RELATION_INCLUDE,
  USER_WORK_SERIES_LINK_INCLUDE,
  type GraphPayloadKey,
} from './sync-push.shared';
import {
  toPushSyncContributorPayload,
  toPushSyncSeriesPayload,
  toPushSyncWorkContributorPayload,
  toPushSyncWorkRelationPayload,
  toPushSyncWorkSeriesLinkPayload,
} from './sync-push.payload-mappers';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export async function applySeriesChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncSeriesPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const existing = await client.userSeries.findUnique({
    where: { id: change.entityId },
  });

  if (!existing) {
    return applyMissingRemoteSeriesChange(userId, change, payload, client);
  }

  if (existing.userId !== userId) {
    return buildGraphOwnershipConflict(change, 'series');
  }

  const validationError = await validateSeriesParent(userId, payload, client);
  if (validationError) {
    return buildGraphValidationFailure(change, 'series', validationError, {
      series: toPushSyncSeriesPayload(existing),
    });
  }

  if (
    existing.serverVersion > payload.serverVersion &&
    !areSeriesEquivalent(existing, payload)
  ) {
    return buildGraphRemoteNewerConflict(change, 'series', {
      series: toPushSyncSeriesPayload(existing),
    });
  }

  if (areSeriesEquivalent(existing, payload)) {
    return buildGraphAppliedResult(change, 'series', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      series: toPushSyncSeriesPayload(existing),
    });
  }

  const updated = await client.userSeries.update({
    where: { id: change.entityId },
    data: buildSeriesUpdateData(payload),
  });

  return buildGraphAppliedResult(change, 'series', {
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    series: toPushSyncSeriesPayload(updated),
  });
}

export async function applyContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncContributorPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const existing = await client.userContributor.findUnique({
    where: { id: change.entityId },
  });

  if (!existing) {
    return applyMissingRemoteContributorChange(userId, change, payload, client);
  }

  if (existing.userId !== userId) {
    return buildGraphOwnershipConflict(change, 'contributor');
  }

  if (
    existing.serverVersion > payload.serverVersion &&
    !areContributorsEquivalent(existing, payload)
  ) {
    return buildGraphRemoteNewerConflict(change, 'contributor', {
      contributor: toPushSyncContributorPayload(existing),
    });
  }

  if (areContributorsEquivalent(existing, payload)) {
    return buildGraphAppliedResult(change, 'contributor', {
      code: SYNC_CODES.alreadyApplied,
      contributor: toPushSyncContributorPayload(existing),
      message: ALREADY_APPLIED_MESSAGE,
    });
  }

  const updated = await client.userContributor.update({
    where: { id: change.entityId },
    data: buildContributorUpdateData(payload),
  });

  return buildGraphAppliedResult(change, 'contributor', {
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    contributor: toPushSyncContributorPayload(updated),
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
  });
}

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

async function applyMissingRemoteSeriesChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncSeriesPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, payload);
  if (missingResult) return missingResult;

  const validationError = await validateSeriesParent(userId, payload, client);
  if (validationError) {
    return buildGraphValidationFailure(change, 'series', validationError, {
      series: null,
    });
  }

  const created = await client.userSeries.create({
    data: buildSeriesCreateData(userId, payload),
  });

  return buildGraphAppliedResult(change, 'series', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    series: toPushSyncSeriesPayload(created),
  });
}

async function applyMissingRemoteContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncContributorPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, payload);
  if (missingResult) return missingResult;

  const created = await client.userContributor.create({
    data: buildContributorCreateData(userId, payload),
  });

  return buildGraphAppliedResult(change, 'contributor', {
    code: SYNC_CODES.created,
    contributor: toPushSyncContributorPayload(created),
    message: CREATED_MESSAGE,
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

async function validateSeriesParent(
  userId: string,
  payload: SyncSeriesPayloadDto,
  client: SyncPushClient,
) {
  if (!payload.parentId) {
    return null;
  }

  if (payload.parentId === payload.id) {
    return 'Series parent cannot point to itself.';
  }

  const parent = await client.userSeries.findFirst({
    where: {
      id: payload.parentId,
      userId,
    },
  });

  return parent ? null : 'Series parent is missing or belongs to a different user.';
}

async function validateWorkSeriesLinkTarget(
  userId: string,
  payload: SyncWorkSeriesLinkPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
) {
  const [work, series] = await Promise.all([
    userRecordsService.findById(payload.workId),
    client.userSeries.findFirst({
      where: {
        id: payload.seriesId,
        userId,
      },
    }),
  ]);

  if (!work || work.userId !== userId) {
    return 'Series link parent work is missing or belongs to a different user.';
  }

  if (!series) {
    return 'Series link target series is missing or belongs to a different user.';
  }

  return null;
}

async function validateWorkContributorTarget(
  userId: string,
  payload: SyncWorkContributorPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
) {
  const [work, contributor] = await Promise.all([
    userRecordsService.findById(payload.workId),
    client.userContributor.findFirst({
      where: {
        id: payload.contributorId,
        userId,
      },
    }),
  ]);

  if (!work || work.userId !== userId) {
    return 'Contributor link parent work is missing or belongs to a different user.';
  }

  if (!contributor) {
    return 'Contributor link target is missing or belongs to a different user.';
  }

  return null;
}

async function validateWorkRelationTarget(
  userId: string,
  payload: SyncWorkRelationPayloadDto,
  userRecordsService: UserRecordsService,
) {
  if (payload.sourceWorkId === payload.targetWorkId) {
    return 'Work relation cannot point to the same work.';
  }

  const [sourceWork, targetWork] = await Promise.all([
    userRecordsService.findById(payload.sourceWorkId),
    userRecordsService.findById(payload.targetWorkId),
  ]);

  if (!sourceWork || sourceWork.userId !== userId) {
    return 'Relation source work is missing or belongs to a different user.';
  }

  if (!targetWork || targetWork.userId !== userId) {
    return 'Relation target work is missing or belongs to a different user.';
  }

  return null;
}

function getMissingRemoteGraphResult(
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
          ? 'Server mismatch: the graph record was already missing remotely.'
          : MISSING_REMOTE_DELETE_NOOP_MESSAGE,
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
    };
  }

  return null;
}

function buildGraphOwnershipConflict(
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

function buildGraphParentChangedConflict(
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

function buildGraphRemoteNewerConflict(
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

function buildGraphValidationFailure(
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

function buildGraphAppliedResult(
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
