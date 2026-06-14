import type { Prisma } from '@prisma/client';

import type { CatalogService } from '../../catalog/catalog.service';
import type {
  UserRecordsService,
  WorkAggregate,
} from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { toFlatWorkResponse } from '../../works/work-aggregate';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import { areWorksEquivalent } from './sync-push.equivalence';
import { buildMissingWorkCreatePlan } from './sync-push.work-create-plan';
import {
  buildWorkAppliedResult,
  buildWorkCreateFailure,
  buildWorkOwnershipConflict,
  buildWorkRemoteNewerConflict,
  buildWorkValidationFailure,
  getMissingRemoteWorkResult,
} from './sync-push.work-results';
import { buildExistingWorkUpdatePlan } from './sync-push.work-update-plan';
import { validateWorkProgressPayload } from './sync-push.work-validation';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
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
    return buildWorkValidationFailure(change, progressValidationError);
  }

  const existing = await dependencies.userRecordsService.findById(
    change.entityId,
    client,
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
    return buildWorkOwnershipConflict(change);
  }

  if (areWorksEquivalent(existing, payload)) {
    return buildWorkAppliedResult(change, {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      work: toFlatWorkResponse(existing),
    });
  }

  if (existing.serverVersion > payload.serverVersion) {
    return buildWorkRemoteNewerConflict(change, toFlatWorkResponse(existing));
  }

  // Keep catalog compatibility metadata and the user record update in the
  // same sync mutation transaction.
  const updatePlan = buildExistingWorkUpdatePlan(existing, payload);

  await dependencies.catalogService.update(
    updatePlan.catalogWorkId,
    updatePlan.catalogUpdateData,
    client,
  );

  const updated = await dependencies.userRecordsService.updateWithVersionGuard(
    updatePlan.userRecordId,
    userId,
    existing.serverVersion,
    updatePlan.userRecordUpdateData,
    client,
  );

  if (!updated) {
    // A concurrent writer advanced serverVersion between our read and the
    // guarded write, so the locally-read base is stale: treat as remote-newer.
    const latest = await dependencies.userRecordsService.findById(
      updatePlan.userRecordId,
      client,
    );

    return buildWorkRemoteNewerConflict(
      change,
      toFlatWorkResponse(latest ?? existing),
    );
  }

  return buildWorkAppliedResult(change, {
    code: updatePlan.resultCode,
    message: updatePlan.resultMessage,
    work: toFlatWorkResponse(updated),
  });
}

async function applyMissingRemoteWorkChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushWorkDependencies,
): Promise<PushSyncResultDto> {
  const missingRemoteResult = getMissingRemoteWorkResult(change, payload);

  if (missingRemoteResult) {
    return missingRemoteResult;
  }

  const existingTitle = payload.catalogTitleId
    ? await findCatalogTitleForSyncCreate(client, payload.catalogTitleId)
    : null;
  const createPlanResult = buildMissingWorkCreatePlan(
    userId,
    payload,
    existingTitle,
  );

  if (createPlanResult.status === 'failed') {
    return buildWorkCreateFailure(change, {
      code: createPlanResult.code,
      message: createPlanResult.message,
    });
  }

  let created: WorkAggregate;
  const { plan } = createPlanResult;

  if (plan.source === 'existing-catalog-title') {
    await client.catalogWork.create({
      data: plan.compatibilityCatalogWorkCreateData,
    });

    created = await dependencies.userRecordsService.create(
      plan.userRecordCreateData,
      client,
    );
  } else if (plan.source === 'import-draft') {
    const title =
      await dependencies.catalogService.createTitleFromImportCandidate(
        plan.importTitleCreateData,
        client,
      );

    await client.catalogWork.create({
      data: plan.compatibilityCatalogWorkCreateData,
    });

    created = await dependencies.userRecordsService.create(
      plan.buildUserRecordCreateData(title.id),
      client,
    );
  } else {
    await dependencies.catalogService.create(plan.catalogCreateData, client);

    created = await dependencies.userRecordsService.create(
      plan.userRecordCreateData,
      client,
    );
  }

  return buildWorkAppliedResult(change, {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    work: toFlatWorkResponse(created),
  });
}

function findCatalogTitleForSyncCreate(client: SyncPushClient, id: string) {
  return client.catalogTitle.findUnique({
    where: {
      id,
    },
    include: SYNC_CREATE_TITLE_INCLUDE,
  });
}
