import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_JSON_BACKUP_STALE_DAYS,
  getArchiveSafetyState,
} from './sync-safety-state';

const NOW = new Date('2026-07-26T00:00:00.000Z');
const persistentStorage = {
  persisted: true,
  quotaBytes: null,
  supported: true,
  usageBytes: null,
};

function buildState(
  overrides: Partial<Parameters<typeof getArchiveSafetyState>[0]> = {},
) {
  return getArchiveSafetyState({
    activeRecordCount: 1,
    conflictCount: 0,
    failedCount: 0,
    lastJsonBackupAt: '2026-07-25T00:00:00.000Z',
    lastSuccessfulPullAt: null,
    lastSuccessfulPushAt: null,
    mode: 'authenticated',
    now: NOW,
    pendingCount: 0,
    requeuedCount: 0,
    staleStatusAt: null,
    storageState: persistentStorage,
    ...overrides,
  });
}

describe('getArchiveSafetyState', () => {
  it('treats any non-empty archive without a JSON export as missing backup', () => {
    expect(buildState({ lastJsonBackupAt: null }).jsonBackup.status).toBe(
      'missing',
    );
  });

  it(`marks a JSON backup stale at ${ARCHIVE_JSON_BACKUP_STALE_DAYS} days`, () => {
    const state = buildState({
      lastJsonBackupAt: '2026-06-26T00:00:00.000Z',
    });

    expect(state.jsonBackup.daysSince).toBe(30);
    expect(state.jsonBackup.status).toBe('stale');
  });

  it('keeps a 29-day JSON backup current', () => {
    expect(
      buildState({ lastJsonBackupAt: '2026-06-27T00:00:00.000Z' })
        .jsonBackup.status,
    ).toBe('current');
  });

  it('keeps pull and push evidence as distinct fields', () => {
    const state = buildState({
      lastSuccessfulPullAt: '2026-07-25T01:00:00.000Z',
      lastSuccessfulPushAt: '2026-07-24T01:00:00.000Z',
    });

    expect(state.sync.lastSuccessfulPullAt).toBe('2026-07-25T01:00:00.000Z');
    expect(state.sync.lastSuccessfulPushAt).toBe('2026-07-24T01:00:00.000Z');
  });

  it('prioritizes conflicts and failures over otherwise healthy evidence', () => {
    const state = buildState({ conflictCount: 1, failedCount: 2 });

    expect(state.level).toBe('action');
    expect(state.sync.status).toBe('needs-review');
  });
});
