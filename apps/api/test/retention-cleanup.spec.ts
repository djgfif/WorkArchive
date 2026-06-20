import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  assertRetentionCleanupCanRun,
  buildRetentionCleanupTargets,
  readRetentionCleanupConfig,
  runRetentionCleanup,
  type RetentionPrismaClient,
} from '../src/operations/retention-cleanup';

describe('retention cleanup', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds explicit delete predicates for long-lived operational tables', () => {
    const config = readRetentionCleanupConfig(
      {
        RETENTION_EXPIRED_REFRESH_SESSION_DAYS: '14',
        RETENTION_REVOKED_REFRESH_SESSION_DAYS: '21',
        RETENTION_SECURITY_EVENT_DAYS: '90',
      },
      new Date('2026-05-22T00:00:00.000Z'),
    );

    const targets = buildRetentionCleanupTargets(config);

    expect(targets).toHaveLength(4);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'security_events',
          where: {
            createdAt: {
              lt: new Date('2026-02-21T00:00:00.000Z'),
            },
          },
        }),
        expect.objectContaining({
          name: 'user_refresh_sessions',
          where: {
            OR: [
              {
                revokedAt: {
                  lt: new Date('2026-05-01T00:00:00.000Z'),
                  not: null,
                },
              },
              {
                expiresAt: {
                  lt: new Date('2026-05-08T00:00:00.000Z'),
                },
              },
            ],
          },
        }),
        expect.objectContaining({
          name: 'user_sync_applied_mutations',
          where: {
            expiresAt: {
              lt: new Date('2026-05-22T00:00:00.000Z'),
              not: null,
            },
          },
        }),
        expect.objectContaining({
          name: 'notion_pull_preview_snapshots',
          where: {
            expiresAt: {
              lt: new Date('2026-05-22T00:00:00.000Z'),
            },
          },
        }),
      ]),
    );
  });

  it('dry-runs by default without deleting matched rows', async () => {
    const calls: string[] = [];
    const prisma = createRetentionPrismaMock(calls, 12);
    const config = readRetentionCleanupConfig(
      {},
      new Date('2026-05-22T00:00:00.000Z'),
    );

    const results = await runRetentionCleanup(prisma, config);

    expect(results).toEqual([
      {
        deleted: 0,
        dryRun: true,
        matched: 12,
        name: 'security_events',
      },
      {
        deleted: 0,
        dryRun: true,
        matched: 12,
        name: 'user_refresh_sessions',
      },
      {
        deleted: 0,
        dryRun: true,
        matched: 12,
        name: 'user_sync_applied_mutations',
      },
      {
        deleted: 0,
        dryRun: true,
        matched: 12,
        name: 'notion_pull_preview_snapshots',
      },
    ]);
    expect(calls).toEqual([
      'securityEvent.count',
      'userRefreshSession.count',
      'userSyncAppliedMutation.count',
      'notionPullPreviewSnapshot.count',
    ]);
  });

  it('requires explicit confirmation before production deletes', () => {
    const config = readRetentionCleanupConfig({
      RETENTION_CLEANUP_DRY_RUN: 'false',
    });

    expect(() =>
      assertRetentionCleanupCanRun(config, {
        NODE_ENV: 'production',
      }),
    ).toThrow(/RETENTION_CLEANUP_CONFIRM/);
  });

  it('allows production deletes only with the explicit confirmation phrase', () => {
    const config = readRetentionCleanupConfig({
      RETENTION_CLEANUP_CONFIRM: 'delete-expired-operational-data',
      RETENTION_CLEANUP_DRY_RUN: 'false',
    });

    expect(() =>
      assertRetentionCleanupCanRun(config, {
        NODE_ENV: 'production',
      }),
    ).not.toThrow();
  });

  it('rejects non-positive retention day values', () => {
    expect(() =>
      readRetentionCleanupConfig({
        RETENTION_SECURITY_EVENT_DAYS: '0',
      }),
    ).toThrow(/positive integer/);
  });
});

function createRetentionPrismaMock(
  calls: string[],
  matched: number,
): RetentionPrismaClient {
  return {
    notionPullPreviewSnapshot: createDelegate(
      'notionPullPreviewSnapshot',
      calls,
      matched,
    ),
    securityEvent: createDelegate('securityEvent', calls, matched),
    userSyncAppliedMutation: createDelegate(
      'userSyncAppliedMutation',
      calls,
      matched,
    ),
    userRefreshSession: createDelegate('userRefreshSession', calls, matched),
  };
}

function createDelegate(name: string, calls: string[], matched: number) {
  return {
    count: async () => {
      calls.push(`${name}.count`);

      return matched;
    },
    deleteMany: async () => {
      calls.push(`${name}.deleteMany`);

      return {
        count: matched,
      };
    },
  };
}
