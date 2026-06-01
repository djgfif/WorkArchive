import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { moveUnknownGenresToPersonalTags } from '@work-archive/shared-types';

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

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
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
    const normalizedCatalog = moveUnknownGenresToPersonalTags(work.genres);
    const movedTags = normalizedCatalog.personalTags;

    if (movedTags.length === 0 && arraysEqual(work.genres, normalizedCatalog.genres)) {
      continue;
    }

    result.changedCatalogWorks += 1;

    for (const tag of movedTags) {
      if (result.movedTagSamples.length < sampleLimit) {
        result.movedTagSamples.push(tag);
      }
    }

    const nextUserRecords = work.userRecords.map((record) => ({
      id: record.id,
      personalTags: moveUnknownGenresToPersonalTags(
        work.genres,
        record.personalTags,
      ).personalTags,
    }));
    const changedUserRecords = nextUserRecords.filter((record) => {
      const current = work.userRecords.find((entry) => entry.id === record.id);

      return current ? !arraysEqual(current.personalTags, record.personalTags) : false;
    });

    result.changedUserRecords += changedUserRecords.length;

    if (!options.apply) {
      continue;
    }

    await prisma.$transaction(async (tx: MigrationTransactionClient) => {
      await tx.catalogWork.update({
        where: {
          id: work.id,
        },
        data: {
          genres: normalizedCatalog.genres,
        },
      });

      for (const record of changedUserRecords) {
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
    console.error(
      JSON.stringify({
        errorCode: error instanceof Error ? error.name : 'UnknownError',
        event: 'operations.migrate_legacy_genres_to_tags.failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    process.exitCode = 1;
  });
}
