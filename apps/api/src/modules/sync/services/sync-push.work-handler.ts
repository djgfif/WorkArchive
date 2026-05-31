import type { Prisma, WorkType } from '@prisma/client';

import type { CatalogService } from '../../catalog/catalog.service';
import { canUseProgressUnit } from '../../recording/recording-policy';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { toFlatWorkResponse } from '../../works/work-aggregate';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import {
  buildCatalogCreateData,
  buildCatalogUpdateData,
  buildCompatibilityCatalogWorkCreateData,
  buildImportTitleCreateData,
  buildUserRecordCreateData,
  buildUserRecordUpdateData,
  resolveImportDraftCatalogTitle,
} from './sync-push.data-builders';
import { areWorksEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SYNC_CODES,
  SYNC_CREATE_TITLE_INCLUDE,
} from './sync-push.shared';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export interface SyncPushWorkDependencies {
  catalogService: CatalogService;
  userRecordsService: UserRecordsService;
}

export async function applyWorkChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushWorkDependencies,
): Promise<PushSyncResultDto> {
  const progressValidationError = validateWorkProgressPayload(payload);

  if (progressValidationError) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: progressValidationError,
      work: null,
    };
  }

  const existing = await dependencies.userRecordsService.findById(
    change.entityId,
  );

  if (!existing) {
    return applyMissingRemoteWorkChange(
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
      entityType: 'work',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Server mismatch: the record cannot be modified remotely.',
      work: null,
    };
  }

  if (areWorksEquivalent(existing, payload)) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      work: toFlatWorkResponse(existing),
    };
  }

  if (existing.serverVersion > payload.serverVersion) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteNewer,
      message: 'Server mismatch: the work record has a newer remote version.',
      work: toFlatWorkResponse(existing),
    };
  }

  // Keep catalog compatibility metadata and the user record update in the
  // same sync mutation transaction.
  await dependencies.catalogService.update(
    existing.catalogWorkId,
    buildCatalogUpdateData(payload),
    client,
  );

  const updated = await dependencies.userRecordsService.update(
    change.entityId,
    buildUserRecordUpdateData(payload),
    client,
  );

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'work',
    status: 'applied',
    code:
      payload.deletedAt === null
        ? SYNC_CODES.appliedChange
        : SYNC_CODES.appliedTombstone,
    message:
      payload.deletedAt === null
        ? APPLIED_CHANGE_MESSAGE
        : APPLIED_TOMBSTONE_MESSAGE,
    work: toFlatWorkResponse(updated),
  };
}

async function applyMissingRemoteWorkChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushWorkDependencies,
): Promise<PushSyncResultDto> {
  const isDelete = change.operation === 'delete' || payload.deletedAt !== null;
  const canCreate = change.operation === 'create' && payload.serverVersion === 0;

  if (isDelete) {
    if (payload.serverVersion > 0) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        code: SYNC_CODES.conflictRemoteMissing,
        message:
          'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.',
        work: null,
      };
    }

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      work: null,
    };
  }

  if (!canCreate) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Server mismatch: the record does not exist remotely anymore.',
      work: null,
    };
  }

  const existingTitle = payload.catalogTitleId
    ? await findCatalogTitleForSyncCreate(client, payload.catalogTitleId)
    : null;
  const importDraftCatalogTitle = payload.importDraft
    ? resolveImportDraftCatalogTitle(payload)
    : null;

  if (payload.catalogTitleId && !existingTitle) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'failed',
      code: SYNC_CODES.failedMissingCatalogTitle,
      message: `Catalog title with id "${payload.catalogTitleId}" was not found.`,
      work: null,
    };
  }

  if (payload.importDraft && !importDraftCatalogTitle) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'failed',
      code: SYNC_CODES.failedImportDraftUnresolved,
      message:
        'Catalog title could not be resolved from importDraft.catalogTitle or payload.title.',
      work: null,
    };
  }

  let created: WorkAggregate;

  if (existingTitle) {
    await client.catalogWork.create({
      data: buildCompatibilityCatalogWorkCreateData(payload, existingTitle),
    });

    created = await dependencies.userRecordsService.create(
      buildUserRecordCreateData(userId, payload, existingTitle.id),
      client,
    );
  } else if (payload.importDraft) {
    const title =
      await dependencies.catalogService.createTitleFromImportCandidate(
        buildImportTitleCreateData(payload, importDraftCatalogTitle!),
        client,
      );

    await client.catalogWork.create({
      data: buildCompatibilityCatalogWorkCreateData(payload),
    });

    created = await dependencies.userRecordsService.create(
      buildUserRecordCreateData(userId, payload, title.id),
      client,
    );
  } else {
    await dependencies.catalogService.create(buildCatalogCreateData(payload), client);

    created = await dependencies.userRecordsService.create(
      buildUserRecordCreateData(userId, payload),
      client,
    );
  }

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: 'work',
    status: 'applied',
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    work: toFlatWorkResponse(created),
  };
}

function validateWorkProgressPayload(payload: SyncWorkPayloadDto) {
  if (payload.progressUnit !== null && payload.progressUnit !== undefined) {
    const type = payload.type as WorkType;

    if (!canUseProgressUnit(type, payload.progressUnit)) {
      return `Progress unit "${payload.progressUnit}" is not supported for medium type "${payload.type}".`;
    }
  }

  if (
    payload.progressCurrent !== null &&
    payload.progressCurrent !== undefined &&
    payload.progressTotal !== null &&
    payload.progressTotal !== undefined &&
    payload.progressCurrent > payload.progressTotal
  ) {
    return 'progressCurrent cannot exceed progressTotal.';
  }

  return null;
}

function findCatalogTitleForSyncCreate(client: SyncPushClient, id: string) {
  return client.catalogTitle.findUnique({
    where: {
      id,
    },
    include: SYNC_CREATE_TITLE_INCLUDE,
  });
}
