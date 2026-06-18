import type { Prisma } from '@prisma/client';

import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import {
  buildWorkContributorCreateData,
  buildWorkContributorUpdateData,
} from './sync-push.data-builders';
import { areWorkContributorsEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  USER_WORK_CONTRIBUTOR_INCLUDE,
  getAppliedMutationResult,
} from './sync-push.shared';
import { toPushSyncWorkContributorPayload } from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphParentChangedConflict,
  buildGraphRemoteNewerConflict,
  buildGraphValidationFailure,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';
import { validateWorkContributorTarget } from './sync-push.graph-validation';

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

  const updateResult = await client.userWorkContributor.updateMany({
    where: {
      id: change.entityId,
      serverVersion: existing.serverVersion,
      userContributor: {
        userId,
      },
      userWork: {
        userId,
      },
    },
    data: buildWorkContributorUpdateData(
      payload,
    ) as Prisma.UserWorkContributorUpdateManyMutationInput,
  });
  const updated = await client.userWorkContributor.findFirst({
    where: {
      id: change.entityId,
      userContributor: {
        userId,
      },
      userWork: {
        userId,
      },
    },
    include: USER_WORK_CONTRIBUTOR_INCLUDE,
  });

  if (updateResult.count === 0 || !updated) {
    const latest = await client.userWorkContributor.findFirst({
      where: {
        id: change.entityId,
        userContributor: {
          userId,
        },
        userWork: {
          userId,
        },
      },
      include: USER_WORK_CONTRIBUTOR_INCLUDE,
    });

    return buildGraphRemoteNewerConflict(change, 'workContributor', {
      workContributor: latest
        ? toPushSyncWorkContributorPayload(latest)
        : toPushSyncWorkContributorPayload(existing),
    });
  }

  return buildGraphAppliedResult(change, 'workContributor', {
    ...getAppliedMutationResult(payload.deletedAt),
    workContributor: toPushSyncWorkContributorPayload(updated),
  });
}

async function applyMissingRemoteWorkContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncWorkContributorPayloadDto,
  client: SyncPushClient,
  userRecordsService: UserRecordsService,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(
    change,
    'workContributor',
    payload,
  );
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
