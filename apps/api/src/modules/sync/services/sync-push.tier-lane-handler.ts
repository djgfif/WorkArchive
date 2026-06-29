import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncTierLanePayloadDto } from '../payloads/sync-tier-board-payload.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';
import type { SyncPushClient } from './sync-push.client';
import { toPushSyncTierLanePayload } from './sync-push.payload-mappers';
import { buildTierLaneCreateData } from './sync-push.tier-board-data';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardParentConflict,
  buildTierBoardRemoteNewerConflict,
} from './sync-push.tier-board-results';
import { validateTierLaneParents } from './sync-push.tier-board-validation';
import { updateTierLaneWithVersionGuard } from './sync-push.tier-board-version-guards';

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

  if (existing && existing.serverVersion > payload.serverVersion) {
    return buildTierBoardRemoteNewerConflict(
      change,
      'tierLane',
      'Remote tier lane is newer than the queued change.',
      {
        tierLane: toPushSyncTierLanePayload(existing),
      },
    );
  }

  const record = existing
    ? await updateTierLaneWithVersionGuard(
        userId,
        change,
        payload,
        client,
        existing.serverVersion,
      )
    : await client.userTierLane.create({
        data: buildTierLaneCreateData(payload),
      });

  if (!record) {
    const latest = await client.userTierLane.findFirst({
      where: {
        board: {
          userId,
        },
        id: change.entityId,
      },
      include: { board: true },
    });

    return buildTierBoardRemoteNewerConflict(
      change,
      'tierLane',
      'Remote tier lane is newer than the queued change.',
      {
        tierLane: latest ? toPushSyncTierLanePayload(latest) : null,
      },
    );
  }

  return buildTierBoardAppliedResult(change, {
    tierLane: toPushSyncTierLanePayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}
