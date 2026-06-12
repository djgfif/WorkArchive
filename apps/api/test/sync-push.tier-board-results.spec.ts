import { describe, expect, it } from '@jest/globals';

import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import {
  buildTierBoardAppliedResult,
  buildTierBoardDeleteNoop,
  buildTierBoardOwnershipConflict,
  buildTierBoardParentConflict,
  buildTierBoardRemoteNewerConflict,
} from '../src/modules/sync/services/sync-push.tier-board-results';
import { SYNC_CODES } from '../src/modules/sync/services/sync-push.shared';

const baseChange: PushSyncChangeDto = {
  queueId: '51f573a9-17fa-4f27-bf7b-f292a45c7b3e',
  entityType: 'tier_board_card',
  entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
  operation: 'update',
  createdAt: '2026-04-18T00:00:00.000Z',
  payload: {},
} as PushSyncChangeDto;

describe('sync push tier board results', () => {
  it('builds ownership conflicts with sync identity fields', () => {
    expect(buildTierBoardOwnershipConflict(baseChange)).toMatchObject({
      queueId: baseChange.queueId,
      entityId: baseChange.entityId,
      entityType: 'tier_board_card',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Server mismatch: the tier board entity belongs to another user.',
    });
  });

  it('builds parent conflicts for the requested payload key', () => {
    expect(
      buildTierBoardParentConflict(
        {
          ...baseChange,
          entityType: 'tier_lane',
        },
        'tierLane',
        'Lane parent is missing.',
      ),
    ).toMatchObject({
      entityType: 'tier_lane',
      status: 'conflict',
      code: SYNC_CODES.conflictParentChanged,
      message: 'Lane parent is missing.',
      tierLane: null,
    });
  });

  it('builds delete noops for top-level boards', () => {
    expect(
      buildTierBoardDeleteNoop(
        {
          ...baseChange,
          entityType: 'tier_board',
          operation: 'delete',
        },
        'tierBoard',
      ),
    ).toMatchObject({
      entityType: 'tier_board',
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      tierBoard: null,
    });
  });

  it('keeps remote-newer payload snapshots', () => {
    expect(
      buildTierBoardRemoteNewerConflict(
        {
          ...baseChange,
          entityType: 'tier_board',
        },
        'tierBoard',
        'Remote tier board is newer.',
        {
          tierBoard: {
            id: baseChange.entityId,
          } as never,
        },
      ),
    ).toMatchObject({
      entityType: 'tier_board',
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteNewer,
      message: 'Remote tier board is newer.',
      tierBoard: {
        id: baseChange.entityId,
      },
    });
  });

  it('builds applied results with explicit code and message', () => {
    expect(
      buildTierBoardAppliedResult(baseChange, {
        code: SYNC_CODES.created,
        message: 'Created.',
        tierBoardCard: {
          id: baseChange.entityId,
        } as never,
      }),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.created,
      message: 'Created.',
      tierBoardCard: {
        id: baseChange.entityId,
      },
    });
  });
});
