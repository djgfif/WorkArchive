import type { Prisma } from '@prisma/client';

import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import {
  buildTierBoardAssetUpdateData,
  buildTierBoardCardUpdateData,
  buildTierBoardUpdateData,
  buildTierLaneUpdateData,
} from './sync-push.tier-board-data';
import type { SyncPushClient } from './sync-push.client';

export async function updateTierBoardWithVersionGuard(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardPayloadDto,
  client: SyncPushClient,
  expectedServerVersion: number,
) {
  const result = await client.userTierBoard.updateMany({
    where: {
      id: change.entityId,
      serverVersion: expectedServerVersion,
      userId,
    },
    data: buildTierBoardUpdateData(
      payload,
    ) as Prisma.UserTierBoardUpdateManyMutationInput,
  });

  if (result.count === 0) {
    return null;
  }

  return client.userTierBoard.findFirst({
    where: {
      id: change.entityId,
      userId,
    },
  });
}

export async function updateTierLaneWithVersionGuard(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierLanePayloadDto,
  client: SyncPushClient,
  expectedServerVersion: number,
) {
  const result = await client.userTierLane.updateMany({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
      serverVersion: expectedServerVersion,
    },
    data: buildTierLaneUpdateData(
      payload,
    ) as Prisma.UserTierLaneUpdateManyMutationInput,
  });

  if (result.count === 0) {
    return null;
  }

  return client.userTierLane.findFirst({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
    },
    include: { board: true },
  });
}

export async function updateTierBoardCardWithVersionGuard(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardCardPayloadDto,
  client: SyncPushClient,
  expectedServerVersion: number,
) {
  const result = await client.userTierBoardCard.updateMany({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
      serverVersion: expectedServerVersion,
    },
    data: buildTierBoardCardUpdateData(
      payload,
    ) as Prisma.UserTierBoardCardUpdateManyMutationInput,
  });

  if (result.count === 0) {
    return null;
  }

  return client.userTierBoardCard.findFirst({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
    },
    include: { board: true },
  });
}

export async function updateTierBoardAssetWithVersionGuard(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardAssetPayloadDto,
  client: SyncPushClient,
  expectedServerVersion: number,
) {
  const result = await client.userTierBoardAsset.updateMany({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
      serverVersion: expectedServerVersion,
    },
    data: buildTierBoardAssetUpdateData(
      payload,
    ) as Prisma.UserTierBoardAssetUpdateManyMutationInput,
  });

  if (result.count === 0) {
    return null;
  }

  return client.userTierBoardAsset.findFirst({
    where: {
      board: {
        userId,
      },
      id: change.entityId,
    },
    include: { board: true },
  });
}
