import { describe, expect, it, jest } from '@jest/globals';

import {
  formatLegacyGenreMigrationFailure,
  runLegacyGenreMigration,
} from '../src/operations/migrate-legacy-genres-to-tags';

describe('legacy genre migration operation', () => {
  it('dry-runs changed catalog and user record counts without writing', async () => {
    const prisma = createMigrationPrismaMock();

    await expect(
      runLegacyGenreMigration(prisma, {
        apply: false,
        sampleLimit: 2,
      }),
    ).resolves.toEqual({
      changedCatalogWorks: 1,
      changedUserRecords: 1,
      dryRun: true,
      movedTagSamples: ['회귀', '빙의'],
      processedCatalogWorks: 2,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates catalog genres and only changed user records in apply mode', async () => {
    const prisma = createMigrationPrismaMock();

    await runLegacyGenreMigration(prisma, {
      apply: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const tx = prisma.tx;

    expect(tx.catalogWork.update).toHaveBeenCalledWith({
      where: {
        id: 'work-with-legacy-genres',
      },
      data: {
        genres: ['판타지', '로맨스', '드라마'],
      },
    });
    expect(tx.userWorkRecord.update).toHaveBeenCalledTimes(1);
    expect(tx.userWorkRecord.update).toHaveBeenCalledWith({
      where: {
        id: 'record-needs-tags',
      },
      data: {
        personalTags: ['완독', '회귀', '빙의', '액션'],
      },
    });
  });

  it('formats operation failures without raw database errors', () => {
    const formatted = formatLegacyGenreMigrationFailure(
      new Error('DATABASE_URL=postgresql://secret access_token raw payload'),
    );

    expect(JSON.parse(formatted)).toEqual({
      errorCode: 'Error',
      event: 'operations.migrate_legacy_genres_to_tags.failed',
    });
    expect(formatted).not.toMatch(
      /DATABASE_URL|postgresql:\/\/secret|access_token|raw payload/,
    );
  });
});

function createMigrationPrismaMock() {
  const tx = createMigrationTransactionMock();

  return {
    catalogWork: {
      findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
        {
          id: 'work-with-legacy-genres',
          genres: ['회귀', '판타지', '빙의', '로맨스', '드라마', '액션'],
          userRecords: [
            {
              id: 'record-needs-tags',
              personalTags: ['완독'],
            },
            {
              id: 'record-already-tagged',
              personalTags: ['회귀', '빙의', '액션'],
            },
          ],
        },
        {
          id: 'work-already-normalized',
          genres: ['판타지'],
          userRecords: [],
        },
      ]),
    },
    $transaction: jest.fn(
      async (
        callback: (
          tx: ReturnType<typeof createMigrationTransactionMock>,
        ) => Promise<void>,
      ) => {
        await callback(tx);
      },
    ),
    tx,
  } as unknown as Parameters<typeof runLegacyGenreMigration>[0] & {
    $transaction: jest.Mock;
    tx: ReturnType<typeof createMigrationTransactionMock>;
  };
}

function createMigrationTransactionMock() {
  return {
    catalogWork: {
      update: jest.fn<(_args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    },
    userWorkRecord: {
      update: jest.fn<(_args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    },
  };
}
