import { describe, expect, it } from '@jest/globals';

import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import {
  buildGraphAppliedResult,
  buildGraphOwnershipConflict,
  getMissingRemoteGraphResult,
} from '../src/modules/sync/services/sync-push.graph-results';
import { SYNC_CODES } from '../src/modules/sync/services/sync-push.shared';

const baseChange: PushSyncChangeDto = {
  queueId: '51f573a9-17fa-4f27-bf7b-f292a45c7b3e',
  entityType: 'series',
  entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
  operation: 'update',
  createdAt: '2026-04-18T00:00:00.000Z',
  payload: {},
} as PushSyncChangeDto;

describe('sync push graph results', () => {
  it('builds ownership conflicts for the requested graph payload key', () => {
    expect(buildGraphOwnershipConflict(baseChange, 'series')).toMatchObject({
      queueId: baseChange.queueId,
      entityId: baseChange.entityId,
      entityType: 'series',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      series: null,
    });
  });

  it('returns delete noop with the requested payload key for missing unsynced records', () => {
    expect(
      getMissingRemoteGraphResult(
        {
          ...baseChange,
          operation: 'delete',
        },
        'workSeriesLink',
        {
          deletedAt: null,
          serverVersion: 0,
        },
      ),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      workSeriesLink: null,
    });
  });

  it('returns remote missing conflicts with the requested payload key', () => {
    expect(
      getMissingRemoteGraphResult(baseChange, 'contributor', {
        deletedAt: null,
        serverVersion: 2,
      }),
    ).toMatchObject({
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      contributor: null,
    });
  });

  it('returns null when missing graph records can be recreated', () => {
    expect(
      getMissingRemoteGraphResult(
        {
          ...baseChange,
          operation: 'create',
        },
        'workRelation',
        {
          deletedAt: null,
          serverVersion: 0,
        },
      ),
    ).toBeNull();
  });

  it('builds applied graph results with the requested payload key', () => {
    expect(
      buildGraphAppliedResult(baseChange, 'series', {
        code: SYNC_CODES.created,
        message: 'Created.',
        series: {
          id: baseChange.entityId,
        } as never,
      }),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.created,
      series: {
        id: baseChange.entityId,
      },
    });
  });
});
