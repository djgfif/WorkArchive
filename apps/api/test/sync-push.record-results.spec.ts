import { describe, expect, it } from '@jest/globals';

import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import {
  buildRecordAppliedResult,
  buildRecordOwnershipConflict,
  buildRecordValidationFailure,
  getMissingRemoteRecordResult,
} from '../src/modules/sync/services/sync-push.record-results';
import { SYNC_CODES } from '../src/modules/sync/services/sync-push.shared';

const baseChange: PushSyncChangeDto = {
  queueId: '51f573a9-17fa-4f27-bf7b-f292a45c7b3e',
  entityType: 'timeline_entry',
  entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
  operation: 'update',
  createdAt: '2026-04-18T00:00:00.000Z',
  payload: {},
} as PushSyncChangeDto;

describe('sync push record results', () => {
  it('builds ownership conflicts for the requested payload key', () => {
    expect(
      buildRecordOwnershipConflict(
        baseChange,
        'timelineEntry',
        'Timeline entry belongs to another user.',
      ),
    ).toMatchObject({
      queueId: baseChange.queueId,
      entityId: baseChange.entityId,
      entityType: 'timeline_entry',
      status: 'conflict',
      code: SYNC_CODES.conflictOwnershipMismatch,
      message: 'Timeline entry belongs to another user.',
      timelineEntry: null,
    });
  });

  it('keeps existing payload snapshots on validation failures', () => {
    expect(
      buildRecordValidationFailure(
        {
          ...baseChange,
          entityType: 'release_record',
        },
        'releaseRecord',
        'Release parent is invalid.',
        {
          releaseRecord: {
            id: baseChange.entityId,
          } as never,
        },
      ),
    ).toMatchObject({
      entityType: 'release_record',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: 'Release parent is invalid.',
      releaseRecord: {
        id: baseChange.entityId,
      },
    });
  });

  it('returns delete noop for missing unsynced records', () => {
    expect(
      getMissingRemoteRecordResult(
        {
          ...baseChange,
          operation: 'delete',
        },
        'timelineEntry',
        {
          deletedAt: null,
          serverVersion: 0,
        },
        {
          deletedSyncedConflict: 'Timeline entry was already missing.',
          missingConflict: 'Timeline entry is missing.',
        },
      ),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      timelineEntry: null,
    });
  });

  it('returns conflict for missing synced tombstones', () => {
    expect(
      getMissingRemoteRecordResult(
        {
          ...baseChange,
          operation: 'delete',
        },
        'timelineEntry',
        {
          deletedAt: null,
          serverVersion: 3,
        },
        {
          deletedSyncedConflict: 'Timeline entry was already missing.',
          missingConflict: 'Timeline entry is missing.',
        },
      ),
    ).toMatchObject({
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message: 'Timeline entry was already missing.',
      timelineEntry: null,
    });
  });

  it('returns null when missing records can be recreated', () => {
    expect(
      getMissingRemoteRecordResult(
        {
          ...baseChange,
          operation: 'create',
        },
        'timelineEntry',
        {
          deletedAt: null,
          serverVersion: 0,
        },
        {
          deletedSyncedConflict: 'Timeline entry was already missing.',
          missingConflict: 'Timeline entry is missing.',
        },
      ),
    ).toBeNull();
  });

  it('builds applied results for release records', () => {
    expect(
      buildRecordAppliedResult(
        {
          ...baseChange,
          entityType: 'release_record',
        },
        'releaseRecord',
        {
          code: SYNC_CODES.created,
          message: 'Created.',
          releaseRecord: {
            id: baseChange.entityId,
          } as never,
        },
      ),
    ).toMatchObject({
      entityType: 'release_record',
      status: 'applied',
      code: SYNC_CODES.created,
      message: 'Created.',
      releaseRecord: {
        id: baseChange.entityId,
      },
    });
  });
});
