import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../../prisma/prisma.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';
import {
  buildTierBoardAssetCreateData,
  buildTierBoardAssetUpdateData,
  buildTierBoardCardCreateData,
  buildTierBoardCardUpdateData,
  buildTierBoardCreateData,
  buildTierBoardUpdateData,
  buildTierLaneCreateData,
  buildTierLaneUpdateData,
} from './sync-push.tier-board-data';
import {
  toPushSyncTierBoardAssetPayload,
  toPushSyncTierBoardCardPayload,
  toPushSyncTierBoardPayload,
  toPushSyncTierLanePayload,
} from './sync-push.payload-mappers';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardParentConflict,
  buildTierBoardRemoteNewerConflict,
} from './sync-push.tier-board-results';
import {
  validateTierBoardAssetParents,
  validateTierBoardCardParents,
  validateTierLaneParents,
} from './sync-push.tier-board-validation';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export async function applyTierBoardChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const existing = await client.userTierBoard.findUnique({
    where: { id: change.entityId },
  });

  if (payload.deletedAt !== null && !existing) {
    return buildTierBoardDeleteNoop(change, 'tierBoard');
  }

  if (existing && existing.userId !== userId) {
    return buildTierBoardOwnershipConflict(change);
  }

  if (existing && existing.serverVersion > payload.serverVersion) {
    return buildTierBoardRemoteNewerConflict(
      change,
      'tierBoard',
      'Remote tier board is newer than the queued change.',
      {
        tierBoard: toPushSyncTierBoardPayload(existing),
      },
    );
  }

  const record = existing
    ? await client.userTierBoard.update({
        where: { id: change.entityId },
        data: buildTierBoardUpdateData(payload),
      })
    : await client.userTierBoard.create({
        data: buildTierBoardCreateData(userId, payload),
      });

  return buildTierBoardAppliedResult(change, {
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    tierBoard: toPushSyncTierBoardPayload(record),
  });
}

export async function applyTierLaneChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierLanePayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const validationError = await validateTierLaneParents(userId, payload, client);
  if (validationError) {
    return buildTierBoardParentConflict(change, 'tierLane', validationError);
  }

  const existing = await client.userTierLane.findUnique({
    where: { id: change.entityId },
    include: { board: true },
  });

  if (payload.deletedAt !== null && !existing) {
    return buildTierBoardDeleteNoop(change, 'tierLane');
  }

  if (existing && existing.board.userId !== userId) {
    return buildTierBoardOwnershipConflict(change);
  }

  const record = existing
    ? await client.userTierLane.update({
        where: { id: change.entityId },
        data: buildTierLaneUpdateData(payload),
      })
    : await client.userTierLane.create({
        data: buildTierLaneCreateData(payload),
      });

  return buildTierBoardAppliedResult(change, {
    tierLane: toPushSyncTierLanePayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}

export async function applyTierBoardCardChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardCardPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const validationError = await validateTierBoardCardParents(
    userId,
    payload,
    client,
  );
  if (validationError) {
    return buildTierBoardParentConflict(
      change,
      'tierBoardCard',
      validationError,
    );
  }

  const existing = await client.userTierBoardCard.findUnique({
    where: { id: change.entityId },
    include: { board: true },
  });

  if (payload.deletedAt !== null && !existing) {
    return buildTierBoardDeleteNoop(change, 'tierBoardCard');
  }

  if (existing && existing.board.userId !== userId) {
    return buildTierBoardOwnershipConflict(change);
  }

  const record = existing
    ? await client.userTierBoardCard.update({
        where: { id: change.entityId },
        data: buildTierBoardCardUpdateData(payload),
      })
    : await client.userTierBoardCard.create({
        data: buildTierBoardCardCreateData(payload),
      });

  return buildTierBoardAppliedResult(change, {
    tierBoardCard: toPushSyncTierBoardCardPayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}

export async function applyTierBoardAssetChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardAssetPayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const validationError = await validateTierBoardAssetParents(
    userId,
    payload,
    client,
  );
  if (validationError) {
    return buildTierBoardParentConflict(
      change,
      'tierBoardAsset',
      validationError,
    );
  }

  const existing = await client.userTierBoardAsset.findUnique({
    where: { id: change.entityId },
    include: { board: true },
  });

  if (payload.deletedAt !== null && !existing) {
    return buildTierBoardDeleteNoop(change, 'tierBoardAsset');
  }

  if (existing && existing.board.userId !== userId) {
    return buildTierBoardOwnershipConflict(change);
  }

  const record = existing
    ? await client.userTierBoardAsset.update({
        where: { id: change.entityId },
        data: buildTierBoardAssetUpdateData(payload),
      })
    : await client.userTierBoardAsset.create({
        data: buildTierBoardAssetCreateData(payload),
      });

  return buildTierBoardAppliedResult(change, {
    tierBoardAsset: toPushSyncTierBoardAssetPayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}
