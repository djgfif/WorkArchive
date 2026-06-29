import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';

import { buildLegacyGenreMigrationWorkPlan } from './legacy-genre-migration-plan';

export interface LegacyGenreMigrationOptions {
  apply: boolean;
  sampleLimit?: number;
}

export interface LegacyGenreMigrationResult {
  changedCatalogWorks: number;
  changedUserRecords: number;
  dryRun: boolean;
  movedTagSamples: string[];
  processedCatalogWorks: number;
}

type MigrationPrismaClient = Pick<PrismaClient, '$transaction' | 'catalogWork'>;
type MigrationTransactionClient = Pick<Prisma.TransactionClient, 'catalogWork' | 'userWorkRecord'>;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured before running this operation.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function parseOptions(argv: string[]): LegacyGenreMigrationOptions {
  return {
    apply: argv.includes('--apply'),
  };
}

export async function runLegacyGenreMigration(
  prisma: MigrationPrismaClient,
  options: LegacyGenreMigrationOptions,
): Promise<LegacyGenreMigrationResult> {
  const sampleLimit = options.sampleLimit ?? 20;
  const catalogWorks = await prisma.catalogWork.findMany({
    include: {
      userRecords: {
        select: {
          id: true,
          personalTags: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });
  const result: LegacyGenreMigrationResult = {
    changedCatalogWorks: 0,
    changedUserRecords: 0,
    dryRun: !options.apply,
    movedTagSamples: [],
    processedCatalogWorks: catalogWorks.length,
  };

  for (const work of catalogWorks) {
    const plan = buildLegacyGenreMigrationWorkPlan(work);

    if (!plan.changedCatalogWork) {
      continue;
    }

    result.changedCatalogWorks += 1;

    for (const tag of plan.movedTags) {
      if (result.movedTagSamples.length < sampleLimit) {
        result.movedTagSamples.push(tag);
      }
    }

    result.changedUserRecords += plan.changedUserRecords.length;

    if (!options.apply) {
      continue;
    }

    await prisma.$transaction(async (tx: MigrationTransactionClient) => {
      await tx.catalogWork.update({
        where: {
          id: work.id,
        },
        data: {
          genres: plan.genres,
        },
      });

      for (const record of plan.changedUserRecords) {
        await tx.userWorkRecord.update({
          where: {
            id: record.id,
          },
          data: {
            personalTags: record.personalTags,
          },
        });
      }
    });
  }

  return result;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const prisma = createPrismaClient();

  try {
    const result = await runLegacyGenreMigration(prisma, options);

    console.log(
      [
        `mode=${result.dryRun ? 'dry-run' : 'apply'}`,
        `processedCatalogWorks=${result.processedCatalogWorks}`,
        `changedCatalogWorks=${result.changedCatalogWorks}`,
        `changedUserRecords=${result.changedUserRecords}`,
      ].join(' '),
    );
    console.log(
      `movedTagSamples=${JSON.stringify(Array.from(new Set(result.movedTagSamples)))}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(formatLegacyGenreMigrationFailure(error));
    process.exitCode = 1;
  });
}

export function formatLegacyGenreMigrationFailure(error: unknown) {
  return JSON.stringify({
    errorCode: error instanceof Error ? error.name : 'UnknownError',
    event: 'operations.migrate_legacy_genres_to_tags.failed',
  });
}
