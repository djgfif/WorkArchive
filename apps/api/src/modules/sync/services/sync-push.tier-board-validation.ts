import { TierBoardCardSourceType, type Prisma } from '@prisma/client';

import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';

type SyncPushClient = Prisma.TransactionClient | PrismaService;

export async function validateTierLaneParents(
  userId: string,
  payload: SyncTierLanePayloadDto,
  client: SyncPushClient,
) {
  const board = await client.userTierBoard.findUnique({
    where: { id: payload.boardId },
  });

  if (!board || board.userId !== userId || board.deletedAt !== null) {
    return 'Parent tier board is missing or belongs to another user.';
  }

  return null;
}

export async function validateTierBoardCardParents(
  userId: string,
  payload: SyncTierBoardCardPayloadDto,
  client: SyncPushClient,
  userRecordsService: Pick<UserRecordsService, 'findById'>,
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

  if (payload.cardSourceType === TierBoardCardSourceType.library_work) {
    if (!payload.workId) {
      return 'Library work tier board cards require a parent work.';
    }
  }

  if (payload.workId) {
    const work = await userRecordsService.findById(payload.workId, client);

    if (!work || work.userId !== userId) {
      return 'Tier board card work is missing or belongs to a different user.';
    }
  }

  return null;
}

export async function validateTierBoardAssetParents(
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
