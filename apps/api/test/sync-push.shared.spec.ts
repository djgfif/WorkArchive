import { describe, expect, it } from '@jest/globals';

import {
  APPLIED_CHANGE_MESSAGE,
  APPLIED_TOMBSTONE_MESSAGE,
  getAppliedMutationResult,
  SYNC_CODES,
} from '../src/modules/sync/services/sync-push.shared';

describe('sync push shared helpers', () => {
  it('selects applied change metadata for active payloads', () => {
    expect(getAppliedMutationResult(null)).toEqual({
      code: SYNC_CODES.appliedChange,
      message: APPLIED_CHANGE_MESSAGE,
    });
  });

  it('selects applied tombstone metadata for deleted payloads', () => {
    expect(getAppliedMutationResult('2026-04-18T01:00:00.000Z')).toEqual({
      code: SYNC_CODES.appliedTombstone,
      message: APPLIED_TOMBSTONE_MESSAGE,
    });
  });
});
