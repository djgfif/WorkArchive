import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import {
  buildContributorCreateData,
  buildContributorUpdateData,
  buildSeriesCreateData,
  buildSeriesUpdateData,
} from './sync-push.data-builders';
import { areContributorsEquivalent, areSeriesEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  getAppliedMutationResult,
} from './sync-push.shared';
import {
  toPushSyncContributorPayload,
  toPushSyncSeriesPayload,
} from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphRemoteNewerConflict,
  buildGraphValidationFailure,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';
import { validateSeriesParent } from './sync-push.graph-validation';

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
    ...getAppliedMutationResult(payload.deletedAt),
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
    ...getAppliedMutationResult(payload.deletedAt),
    contributor: toPushSyncContributorPayload(updated),
  });
}

async function applyMissingRemoteSeriesChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncSeriesPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const missingResult = getMissingRemoteGraphResult(change, 'series', payload);
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
