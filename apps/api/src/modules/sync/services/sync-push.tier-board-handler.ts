import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../../prisma/prisma.service';
import { normalizeString } from '../../works/work-aggregate';
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
  MISSING_REMOTE_DELETE_NOOP_MESSAGE,
  SERVER_SYNC_STATUS,
  SYNC_CODES,
} from './sync-push.shared';
import {
  parseIsoDate,
  parseOptionalIsoDate,
} from './sync-push.data-builders';
import {
  toPushSyncTierBoardAssetPayload,
  toPushSyncTierBoardCardPayload,
  toPushSyncTierBoardPayload,
  toPushSyncTierLanePayload,
} from './sync-push.payload-mappers';

type SyncPushClient = Prisma.TransactionClient | PrismaService;
type TierBoardPayloadKey = 'tierBoardAsset' | 'tierBoardCard' | 'tierLane';

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
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
      tierBoard: null,
    };
  }

  if (existing && existing.userId !== userId) {
    return buildTierBoardOwnershipConflict(change);
  }

  if (existing && existing.serverVersion > payload.serverVersion) {
    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: change.entityType,
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteNewer,
      message: 'Remote tier board is newer than the queued change.',
      tierBoard: toPushSyncTierBoardPayload(existing),
    };
  }

  const record = existing
    ? await client.userTierBoard.update({
        where: { id: change.entityId },
        data: {
          title: normalizeString(payload.title) || payload.id,
          description: normalizeString(payload.description),
          slug: normalizeString(payload.slug) || payload.id,
          boardType: payload.boardType,
          visibility: payload.visibility,
          coverImageUrl: normalizeString(payload.coverImageUrl),
          deletedAt: parseOptionalIsoDate(
            payload.deletedAt,
            'payload.deletedAt',
          ),
          syncStatus: SERVER_SYNC_STATUS,
          serverVersion: { increment: 1 },
        },
      })
    : await client.userTierBoard.create({
        data: {
          id: payload.id,
          userId,
          slug: normalizeString(payload.slug) || payload.id,
          title: normalizeString(payload.title) || payload.id,
          description: normalizeString(payload.description),
          boardType: payload.boardType,
          visibility: payload.visibility,
          coverImageUrl: normalizeString(payload.coverImageUrl),
          createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
          updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
          deletedAt: parseOptionalIsoDate(
            payload.deletedAt,
            'payload.deletedAt',
          ),
          syncStatus: SERVER_SYNC_STATUS,
          serverVersion: 1,
        },
      });

  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    tierBoard: toPushSyncTierBoardPayload(record),
  };
}

export async function applyTierLaneChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierLanePayloadDto,
  client: SyncPushClient,
): Promise<PushSyncResultDto> {
  const board = await client.userTierBoard.findUnique({
    where: { id: payload.boardId },
  });

  if (!board || board.userId !== userId || board.deletedAt !== null) {
    return buildTierBoardParentConflict(change, 'tierLane');
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
        data: {
          title: normalizeString(payload.title) || payload.id,
          description: normalizeString(payload.description),
          colorToken: normalizeString(payload.colorToken) || '#64748b',
          orderIndex: payload.orderIndex,
          deletedAt: parseOptionalIsoDate(
            payload.deletedAt,
            'payload.deletedAt',
          ),
          syncStatus: SERVER_SYNC_STATUS,
          serverVersion: { increment: 1 },
        },
      })
    : await client.userTierLane.create({
        data: {
          id: payload.id,
          boardId: payload.boardId,
          title: normalizeString(payload.title) || payload.id,
          description: normalizeString(payload.description),
          colorToken: normalizeString(payload.colorToken) || '#64748b',
          orderIndex: payload.orderIndex,
          createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
          updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
          deletedAt: parseOptionalIsoDate(
            payload.deletedAt,
            'payload.deletedAt',
          ),
          syncStatus: SERVER_SYNC_STATUS,
          serverVersion: 1,
        },
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

  const data = {
    cardSourceType: payload.cardSourceType,
    title: normalizeString(payload.title) || payload.id,
    subtitle: normalizeString(payload.subtitle),
    imageUrl: normalizeString(payload.imageUrl),
    note: normalizeString(payload.note),
    laneId: payload.laneId,
    userWorkId: payload.workId,
    orderIndex: payload.orderIndex,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
  };
  const record = existing
    ? await client.userTierBoardCard.update({
        where: { id: change.entityId },
        data: { ...data, serverVersion: { increment: 1 } },
      })
    : await client.userTierBoardCard.create({
        data: {
          ...data,
          id: payload.id,
          boardId: payload.boardId,
          createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
          updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
          serverVersion: 1,
        },
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

  const data = {
    kind: payload.kind,
    storageType: payload.storageType,
    objectUrl: normalizeString(payload.objectUrl),
    originalName: normalizeString(payload.originalName),
    mimeType: normalizeString(payload.mimeType),
    sizeBytes: payload.sizeBytes,
    cardId: payload.cardId,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
  };
  const record = existing
    ? await client.userTierBoardAsset.update({
        where: { id: change.entityId },
        data,
      })
    : await client.userTierBoardAsset.create({
        data: {
          ...data,
          id: payload.id,
          boardId: payload.boardId,
          createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
          updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
        },
      });

  return buildTierBoardAppliedResult(change, {
    tierBoardAsset: toPushSyncTierBoardAssetPayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}

function buildTierBoardOwnershipConflict(
  change: PushSyncChangeDto,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictOwnershipMismatch,
    message: 'Server mismatch: the tier board entity belongs to another user.',
  };
}

function buildTierBoardParentConflict(
  change: PushSyncChangeDto,
  key: TierBoardPayloadKey,
  message = 'Parent tier board entity is missing or belongs to another user.',
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'conflict',
    code: SYNC_CODES.conflictParentChanged,
    message,
    [key]: null,
  } as PushSyncResultDto;
}

function buildTierBoardDeleteNoop(
  change: PushSyncChangeDto,
  key: TierBoardPayloadKey,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    code: SYNC_CODES.missingRemoteDeleteNoop,
    message: MISSING_REMOTE_DELETE_NOOP_MESSAGE,
    [key]: null,
  } as PushSyncResultDto;
}

function buildTierBoardAppliedResult(
  change: PushSyncChangeDto,
  data: Partial<PushSyncResultDto>,
): PushSyncResultDto {
  return {
    queueId: change.queueId,
    entityId: change.entityId,
    entityType: change.entityType,
    status: 'applied',
    message: APPLIED_CHANGE_MESSAGE,
    ...data,
  } as PushSyncResultDto;
}

async function validateTierBoardCardParents(
  userId: string,
  payload: SyncTierBoardCardPayloadDto,
  client: SyncPushClient,
) {
  const board = await client.userTierBoard.findUnique({
    where: { id: payload.boardId },
  });

  if (!board || board.userId !== userId || board.deletedAt !== null) {
    return 'Parent tier board is missing or belongs to another user.';
  }

  if (payload.laneId) {
    const lane = await client.userTierLane.findUnique({
      where: { id: payload.laneId },
      include: { board: true },
    });

    if (
      !lane ||
      lane.boardId !== payload.boardId ||
      lane.board.userId !== userId ||
      lane.deletedAt !== null
    ) {
      return 'Parent tier board lane is missing or belongs to another user.';
    }
  }

  return null;
}

async function validateTierBoardAssetParents(
  userId: string,
  payload: SyncTierBoardAssetPayloadDto,
  client: SyncPushClient,
) {
  const board = await client.userTierBoard.findUnique({
    where: { id: payload.boardId },
  });

  if (!board || board.userId !== userId || board.deletedAt !== null) {
    return 'Parent tier board is missing or belongs to another user.';
  }

  if (payload.cardId) {
    const card = await client.userTierBoardCard.findUnique({
      where: { id: payload.cardId },
      include: { board: true },
    });

    if (
      !card ||
      card.boardId !== payload.boardId ||
      card.board.userId !== userId ||
      card.deletedAt !== null
    ) {
      return 'Parent tier board card is missing or belongs to another user.';
    }
  }

  return null;
}
