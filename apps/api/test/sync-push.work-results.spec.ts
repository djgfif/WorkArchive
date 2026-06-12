import { describe, expect, it } from '@jest/globals';

import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import {
  buildWorkAppliedResult,
  buildWorkCreateFailure,
  buildWorkValidationFailure,
  getMissingRemoteWorkResult,
} from '../src/modules/sync/services/sync-push.work-results';
import { SYNC_CODES } from '../src/modules/sync/services/sync-push.shared';

const baseChange: PushSyncChangeDto = {
  queueId: '51f573a9-17fa-4f27-bf7b-f292a45c7b3e',
  entityType: 'work',
  entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
  operation: 'update',
  createdAt: '2026-04-18T00:00:00.000Z',
  payload: {},
} as PushSyncChangeDto;

describe('sync push work results', () => {
  it('wraps work validation failures with the sync identity fields', () => {
    expect(buildWorkValidationFailure(baseChange, 'Bad progress.')).toMatchObject({
      queueId: baseChange.queueId,
      entityId: baseChange.entityId,
      entityType: 'work',
      status: 'failed',
      code: SYNC_CODES.failedValidation,
      message: 'Bad progress.',
      work: null,
    });
  });

  it('wraps create plan failures without leaking partial work payloads', () => {
    expect(
      buildWorkCreateFailure(baseChange, {
        code: SYNC_CODES.failedMissingCatalogTitle,
        message: 'Catalog title is missing.',
      }),
    ).toMatchObject({
      status: 'failed',
      code: SYNC_CODES.failedMissingCatalogTitle,
      message: 'Catalog title is missing.',
      work: null,
    });
  });

  it('returns delete noop when an unsynced missing remote work is deleted', () => {
    expect(
      getMissingRemoteWorkResult(
        {
          ...baseChange,
          operation: 'delete',
        },
        {
          deletedAt: null,
          serverVersion: 0,
        },
      ),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.missingRemoteDeleteNoop,
      work: null,
    });
  });

  it('returns conflict when a previously synced missing remote work is deleted', () => {
    expect(
      getMissingRemoteWorkResult(
        {
          ...baseChange,
          operation: 'delete',
        },
        {
          deletedAt: null,
          serverVersion: 2,
        },
      ),
    ).toMatchObject({
      status: 'conflict',
      code: SYNC_CODES.conflictRemoteMissing,
      message:
        'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.',
      work: null,
    });
  });

  it('returns null when a missing remote work can be recreated', () => {
    expect(
      getMissingRemoteWorkResult(
        {
          ...baseChange,
          operation: 'create',
        },
        {
          deletedAt: null,
          serverVersion: 0,
        },
      ),
    ).toBeNull();
  });

  it('wraps applied results with a work payload', () => {
    expect(
      buildWorkAppliedResult(baseChange, {
        code: SYNC_CODES.alreadyApplied,
        message: 'Already applied.',
        work: {
          id: baseChange.entityId,
        } as never,
      }),
    ).toMatchObject({
      status: 'applied',
      code: SYNC_CODES.alreadyApplied,
      message: 'Already applied.',
      work: {
        id: baseChange.entityId,
      },
    });
  });
});
