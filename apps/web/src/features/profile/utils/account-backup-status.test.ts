import { describe, expect, it } from 'vitest';
import type { SyncDashboardItem } from '@features/sync';

import {
  buildRecoveryGroups,
  classifyFailedItem,
  getAccountBackupStatusTone,
  getItemRecoveryGroup,
  getMergeGroups,
} from './account-backup-status';

function buildDashboardItem(
  overrides: Partial<SyncDashboardItem> = {},
): SyncDashboardItem {
  return {
    autoMerge: null,
    conflictCode: null,
    conflictMessage: null,
    conflictRemote: null,
    deletedAt: null,
    entityId: 'entity-1',
    entityType: 'work',
    id: 'queue-1',
    lastError: null,
    linkTo: '/works/entity-1',
    localSnapshot: {},
    operation: 'upsert',
    retryCount: 0,
    serverVersion: 0,
    source: 'unknown',
    state: 'failed',
    syncStatus: 'failed',
    title: '테스트 작품',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...overrides,
  } as SyncDashboardItem;
}

describe('account backup status helpers', () => {
  it('exposes mergeable field groups only for supported entity types', () => {
    expect(
      getMergeGroups(buildDashboardItem()).map((group) => group.key),
    ).toEqual([
      'status',
      'ratingReview',
      'favorite',
      'progress',
      'dates',
      'tags',
      'metadata',
    ]);
    expect(
      getMergeGroups(buildDashboardItem({ entityType: 'release_record' })).map(
        (group) => group.key,
      ),
    ).toEqual(['status', 'ratingReview', 'favorite']);
    expect(
      getMergeGroups(buildDashboardItem({ entityType: 'timeline_entry' })),
    ).toEqual([]);
  });

  it.each([
    ['request timeout', 'network'],
    ['HTTP 401 unauthorized', 'auth'],
    ['schema validation failed', 'validation'],
    ['unexpected server response', 'unknown'],
  ] as const)('classifies %s as %s', (lastError, expected) => {
    expect(classifyFailedItem({ conflictCode: null, lastError })).toBe(
      expected,
    );
  });

  it('summarizes recovery groups in stable display order', () => {
    const groups = buildRecoveryGroups({
      conflictItems: [
        buildDashboardItem({ id: 'conflict', state: 'conflict' }),
      ],
      failedItems: [
        buildDashboardItem({ id: 'network', lastError: 'fetch timeout' }),
        buildDashboardItem({ id: 'auth', lastError: 'token expired' }),
        buildDashboardItem({ id: 'unknown', lastError: 'server exploded' }),
      ],
      staleStatusAt: '2026-07-15T00:00:00.000Z',
    });

    expect(groups).toEqual([
      { count: 1, key: 'conflict', tone: 'warning' },
      { count: 1, key: 'stale', tone: 'info' },
      { count: 1, key: 'network', tone: 'warning' },
      { count: 1, key: 'auth', tone: 'warning' },
      { count: 1, key: 'unknown', tone: 'muted' },
    ]);
  });

  it('prioritizes conflict state and derives the overall status tone', () => {
    expect(
      getItemRecoveryGroup(
        buildDashboardItem({ lastError: 'network timeout', state: 'conflict' }),
      ),
    ).toBe('conflict');
    expect(
      getAccountBackupStatusTone({
        conflictCount: 0,
        failedCount: 0,
        pendingCount: 2,
        staleStatusAt: null,
      }),
    ).toBe('info');
    expect(
      getAccountBackupStatusTone({
        conflictCount: 0,
        failedCount: 0,
        pendingCount: 0,
        staleStatusAt: null,
      }),
    ).toBe('success');
  });
});
