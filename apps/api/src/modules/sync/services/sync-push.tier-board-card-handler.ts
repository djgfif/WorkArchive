import type { UserRecordsService } from '../../user-records/user-records.service';
import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import type { SyncTierBoardCardPayloadDto } from '../payloads/sync-tier-board-payload.dto';
import {
  APPLIED_CHANGE_MESSAGE,
  CREATED_MESSAGE,
  SYNC_CODES,
} from './sync-push.shared';
import type { SyncPushClient } from './sync-push.client';
import { toPushSyncTierBoardCardPayload } from './sync-push.payload-mappers';
import { buildTierBoardCardCreateData } from './sync-push.tier-board-data';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardParentConflict,
  buildTierBoardRemoteNewerConflict,
} from './sync-push.tier-board-results';
import { validateTierBoardCardParents } from './sync-push.tier-board-validation';
import { updateTierBoardCardWithVersionGuard } from './sync-push.tier-board-version-guards';

export async function applyTierBoardCardChange(
  userId: string,
  change: PushSyncChangeDto,
  payload: SyncTierBoardCardPayloadDto,
  client: SyncPushClient,
  userRecordsService: Pick<UserRecordsService, 'findById'>,
): Promise<PushSyncResultDto> {
  const validationError = await validateTierBoardCardParents(
    userId,
    payload,
    client,
    userRecordsService,
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

  if (existing && existing.serverVersion > payload.serverVersion) {
    return buildTierBoardRemoteNewerConflict(
      change,
      'tierBoardCard',
      'Remote tier board card is newer than the queued change.',
      {
        tierBoardCard: toPushSyncTierBoardCardPayload(existing),
      },
    );
  }

  const record = existing
    ? await updateTierBoardCardWithVersionGuard(
        userId,
        change,
        payload,
        client,
        existing.serverVersion,
      )
    : await client.userTierBoardCard.create({
        data: buildTierBoardCardCreateData(payload),
      });

  if (!record) {
    const latest = await client.userTierBoardCard.findFirst({
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
      'tierBoardCard',
      'Remote tier board card is newer than the queued change.',
      {
        tierBoardCard: latest ? toPushSyncTierBoardCardPayload(latest) : null,
      },
    );
  }

  return buildTierBoardAppliedResult(change, {
    tierBoardCard: toPushSyncTierBoardCardPayload(record),
    code: existing ? SYNC_CODES.appliedChange : SYNC_CODES.created,
    message: existing ? APPLIED_CHANGE_MESSAGE : CREATED_MESSAGE,
  });
}
