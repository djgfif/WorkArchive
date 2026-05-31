import type { UserRecordsService } from '../../user-records/user-records.service';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import type { SyncPushClient } from './sync-push.client';

export async function validateSeriesParent(
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

export async function validateWorkSeriesLinkTarget(
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

export async function validateWorkContributorTarget(
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

export async function validateWorkRelationTarget(
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
