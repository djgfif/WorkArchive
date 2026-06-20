import type { Prisma } from '@prisma/client';

import { canCreateReleaseRecord } from '../../recording/recording-policy';
import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export interface SyncPushRecordValidationDependencies {
  userRecordsService: Pick<UserRecordsService, 'findById'>;
}

export async function validateReleaseRecordTarget(
  userId: string,
  payload: SyncReleaseRecordPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushRecordValidationDependencies,
) {
  const parent = await dependencies.userRecordsService.findById(
    payload.userWorkRecordId,
    client,
  );

  if (!parent || parent.userId !== userId) {
    return 'Release record parent is missing or belongs to a different user.';
  }

  const mediumType = parent.catalogTitle?.mediumType ?? parent.catalogWork.type;

  if (!canCreateReleaseRecord(mediumType)) {
    return `Release-level records are not supported for medium type "${mediumType}".`;
  }

  if (!parent.catalogTitleId) {
    return 'Release-level records require a catalog title bridge.';
  }

  const release = await client.catalogRelease.findFirst({
    where: {
      id: payload.catalogReleaseId,
      catalogTitleId: parent.catalogTitleId,
    },
  });

  if (!release) {
    return 'Catalog release does not belong to the parent catalog title.';
  }

  return null;
}

export async function validateTimelineEntryTarget(
  userId: string,
  payload: SyncTimelineEntryPayloadDto,
  client: SyncPushClient,
  dependencies: SyncPushRecordValidationDependencies,
) {
  const parent = await dependencies.userRecordsService.findById(
    payload.workId,
    client,
  );

  if (!parent || parent.userId !== userId) {
    return 'Timeline entry parent is missing or belongs to a different user.';
  }

  return null;
}
