import type { Prisma } from '@prisma/client';

import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import {
  buildContributorCreateData,
  buildContributorUpdateData,
} from './sync-push.data-builders';
import { areContributorsEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  getAppliedMutationResult,
} from './sync-push.shared';
import { toPushSyncContributorPayload } from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphRemoteNewerConflict,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';

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

  const updateResult = await client.userContributor.updateMany({
    where: {
      id: change.entityId,
      serverVersion: existing.serverVersion,
      userId,
    },
    data: buildContributorUpdateData(
      payload,
    ) as Prisma.UserContributorUpdateManyMutationInput,
  });
  const updated = await client.userContributor.findFirst({
    where: {
      id: change.entityId,
      userId,
    },
  });

  if (updateResult.count === 0 || !updated) {
    const latest = await client.userContributor.findFirst({
      where: {
        id: change.entityId,
        userId,
      },
    });

    return buildGraphRemoteNewerConflict(change, 'contributor', {
      contributor: latest
        ? toPushSyncContributorPayload(latest)
        : toPushSyncContributorPayload(existing),
    });
  }

  return buildGraphAppliedResult(change, 'contributor', {
    ...getAppliedMutationResult(payload.deletedAt),
    contributor: toPushSyncContributorPayload(updated),
  });
}

async function applyMissingRemoteContributorChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncContributorPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(
    change,
    'contributor',
    payload,
  );
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
