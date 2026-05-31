import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  buildWorkSeriesLinkCreateData,
  buildWorkSeriesLinkUpdateData,
} from './sync-push.data-builders';
import { areWorkSeriesLinksEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  USER_WORK_SERIES_LINK_INCLUDE,
} from './sync-push.shared';
import { toPushSyncWorkSeriesLinkPayload } from './sync-push.payload-mappers';
import type { SyncPushClient } from './sync-push.client';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  buildGraphParentChangedConflict,
  buildGraphRemoteNewerConflict,
  buildGraphValidationFailure,
  getMissingRemoteGraphResult,
} from './sync-push.graph-results';
import { validateWorkSeriesLinkTarget } from './sync-push.graph-validation';

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
