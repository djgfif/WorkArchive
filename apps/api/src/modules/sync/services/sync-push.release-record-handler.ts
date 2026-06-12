import type { Prisma } from '@prisma/client';

import {
  USER_RELEASE_RECORD_INCLUDE,
  toUserReleaseRecordResponse,
  type UserReleaseRecordsService,
} from '../../user-records/user-release-records.service';
import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import {
  buildReleaseRecordCreateData,
  buildReleaseRecordUpdateData,
} from './sync-push.data-builders';
import { areReleaseRecordsEquivalent } from './sync-push.equivalence';
import {
  ALREADY_APPLIED_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
  getAppliedMutationResult,
} from './sync-push.shared';
import {
  buildRecordAppliedResult,
  buildRecordOwnershipConflict,
  buildRecordParentConflict,
  buildRecordValidationFailure,
  getMissingRemoteRecordResult,
} from './sync-push.record-results';
import { validateReleaseRecordTarget } from './sync-push.record-validation';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export interface SyncPushReleaseRecordDependencies {
  releaseRecordsService: UserReleaseRecordsService;
  userRecordsService: UserRecordsService;
}

export async function applyReleaseRecordChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushReleaseRecordDependencies,
): Promise<PushSyncResultDto> {
  const existing = await dependencies.releaseRecordsService.findById(
    change.entityId,
  );

  if (!existing) {
    return applyMissingRemoteReleaseRecordChange(
      userId,
      change,
      payload,
      client,
      dependencies,
    );
  }

  if (existing.userWorkRecord.userId !== userId) {
    return buildRecordOwnershipConflict(
      change,
      'releaseRecord',
      'Server mismatch: the release record cannot be modified remotely.',
    );
  }

  if (
    existing.userWorkRecordId !== payload.userWorkRecordId ||
    existing.catalogReleaseId !== payload.catalogReleaseId
  ) {
    return buildRecordParentConflict(
      change,
      'releaseRecord',
      'Server mismatch: release record parent or release changed.',
      {
        releaseRecord: toUserReleaseRecordResponse(existing),
      },
    );
  }

  const validationError = await validateReleaseRecordTarget(
    userId,
    payload,
    client,
    dependencies,
  );

  if (validationError) {
    return buildRecordValidationFailure(
      change,
      'releaseRecord',
      validationError,
      {
        releaseRecord: toUserReleaseRecordResponse(existing),
      },
    );
  }

  if (areReleaseRecordsEquivalent(existing, payload)) {
    return buildRecordAppliedResult(change, 'releaseRecord', {
      code: SYNC_CODES.alreadyApplied,
      message: ALREADY_APPLIED_MESSAGE,
      releaseRecord: toUserReleaseRecordResponse(existing),
    });
  }

  const updated = await dependencies.releaseRecordsService.update(
    change.entityId,
    buildReleaseRecordUpdateData(payload),
    client,
  );

  return buildRecordAppliedResult(change, 'releaseRecord', {
    ...getAppliedMutationResult(payload.deletedAt),
    releaseRecord: toUserReleaseRecordResponse(updated),
  });
}

async function applyMissingRemoteReleaseRecordChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushReleaseRecordDependencies,
): Promise<PushSyncResultDto> {
  const missingRemoteResult = getMissingRemoteRecordResult(
    change,
    'releaseRecord',
    payload,
    {
      deletedSyncedConflict:
        'Server mismatch: the release record was already missing remotely.',
      missingConflict:
        'Server mismatch: the release record does not exist remotely.',
    },
  );

  if (missingRemoteResult) {
    return missingRemoteResult;
  }

  const validationError = await validateReleaseRecordTarget(
    userId,
    payload,
    client,
    dependencies,
  );

  if (validationError) {
    return buildRecordValidationFailure(
      change,
      'releaseRecord',
      validationError,
      {},
    );
  }

  const created = await client.userReleaseRecord.create({
    data: buildReleaseRecordCreateData(payload),
    include: USER_RELEASE_RECORD_INCLUDE,
  });
  const hydrated =
    created.createdAt instanceof Date
      ? created
      : await dependencies.releaseRecordsService.findById(created.id);

  return buildRecordAppliedResult(change, 'releaseRecord', {
    code: SYNC_CODES.created,
    message: CREATED_MESSAGE,
    releaseRecord: hydrated ? toUserReleaseRecordResponse(hydrated) : null,
  });
}
