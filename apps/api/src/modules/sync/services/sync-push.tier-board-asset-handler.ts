import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncTierBoardAssetPayloadDto } from '../payloads/sync-tier-board-payload.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';
import type { SyncPushClient } from './sync-push.client';
import { toPushSyncTierBoardAssetPayload } from './sync-push.payload-mappers';
import { buildTierBoardAssetCreateData } from './sync-push.tier-board-data';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardParentConflict,
  buildTierBoardRemoteNewerConflict,
} from './sync-push.tier-board-results';
import { validateTierBoardAssetParents } from './sync-push.tier-board-validation';
import { updateTierBoardAssetWithVersionGuard } from './sync-push.tier-board-version-guards';

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

  if (existing && existing.serverVersion > payload.serverVersion) {
    return buildTierBoardRemoteNewerConflict(
      change,
      'tierBoardAsset',
      'Remote tier board asset is newer than the queued change.',
      {
        tierBoardAsset: toPushSyncTierBoardAssetPayload(existing),
      },
    );
  }

  const record = existing
    ? await updateTierBoardAssetWithVersionGuard(
        userId,
        change,
        payload,
        client,
        existing.serverVersion,
      )
    : await client.userTierBoardAsset.create({
        data: buildTierBoardAssetCreateData(payload),
      });

  if (!record) {
    const latest = await client.userTierBoardAsset.findFirst({
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
      'tierBoardAsset',
      'Remote tier board asset is newer than the queued change.',
      {
        tierBoardAsset: latest ? toPushSyncTierBoardAssetPayload(latest) : null,
      },
    );
  }

  return buildTierBoardAppliedResult(change, {
    tierBoardAsset: toPushSyncTierBoardAssetPayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}
