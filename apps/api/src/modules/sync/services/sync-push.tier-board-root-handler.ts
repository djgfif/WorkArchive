import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncTierBoardPayloadDto } from '../payloads/sync-tier-board-payload.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';
import type { SyncPushClient } from './sync-push.client';
import { toPushSyncTierBoardPayload } from './sync-push.payload-mappers';
import { buildTierBoardCreateData } from './sync-push.tier-board-data';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardRemoteNewerConflict,
} from './sync-push.tier-board-results';
import { updateTierBoardWithVersionGuard } from './sync-push.tier-board-version-guards';

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
    ? await updateTierBoardWithVersionGuard(
        userId,
        change,
        payload,
        client,
        existing.serverVersion,
      )
    : await client.userTierBoard.create({
        data: buildTierBoardCreateData(userId, payload),
      });

  if (!record) {
    const latest = await client.userTierBoard.findFirst({
      where: {
        id: change.entityId,
        userId,
      },
    });

    return buildTierBoardRemoteNewerConflict(
      change,
      'tierBoard',
      'Remote tier board is newer than the queued change.',
      {
        tierBoard: latest ? toPushSyncTierBoardPayload(latest) : null,
      },
    );
  }

  return buildTierBoardAppliedResult(change, {
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
    tierBoard: toPushSyncTierBoardPayload(record),
  });
}
