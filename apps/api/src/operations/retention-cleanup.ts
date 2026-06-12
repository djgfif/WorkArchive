import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  assertRetentionCleanupCanRun,
  buildRetentionCleanupTargets,
  readRetentionCleanupConfig,
  type RetentionCleanupConfig,
  type RetentionPrismaClient,
} from './retention-cleanup.targets';

export {
  assertRetentionCleanupCanRun,
  buildRetentionCleanupTargets,
  readRetentionCleanupConfig,
  type RetentionCleanupConfig,
  type RetentionCleanupTarget,
  type RetentionPrismaClient,
} from './retention-cleanup.targets';

export interface RetentionCleanupResult {
  deleted: number;
  dryRun: boolean;
  matched: number;
  name: string;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured before running retention cleanup.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export async function runRetentionCleanup(
  prisma: RetentionPrismaClient,
  config: RetentionCleanupConfig,
): Promise<RetentionCleanupResult[]> {
  assertRetentionCleanupCanRun(config);

  const targets = buildRetentionCleanupTargets(config);
  const results: RetentionCleanupResult[] = [];

  for (const target of targets) {
    const delegate = prisma[target.model];
    const matched = await delegate.count({ where: target.where });
    const deleted = config.dryRun
      ? 0
      : (await delegate.deleteMany({ where: target.where })).count;

    logRetentionEvent('operations.retention_cleanup.target', {
      deleted,
      description: target.description,
      dryRun: config.dryRun,
      matched,
      target: target.name,
    });

    results.push({
      deleted,
      dryRun: config.dryRun,
      matched,
      name: target.name,
    });
  }

  logRetentionEvent('operations.retention_cleanup.completed', {
    deleted: results.reduce((sum, result) => sum + result.deleted, 0),
    dryRun: config.dryRun,
    matched: results.reduce((sum, result) => sum + result.matched, 0),
    target: 'all',
  });

  return results;
}

function logRetentionEvent(
  event: string,
  fields: {
    deleted: number;
    description?: string;
    dryRun: boolean;
    matched: number;
    target: string;
  },
) {
  console.log(
    JSON.stringify({
      deleted: fields.deleted,
      description: fields.description ?? null,
      dryRun: fields.dryRun,
      event,
      matched: fields.matched,
      target: fields.target,
    }),
  );
}

async function main() {
  const prisma = createPrismaClient();
  const config = readRetentionCleanupConfig();

  try {
    await runRetentionCleanup(prisma, config);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error(
      JSON.stringify({
        errorCode: 'RetentionCleanupFailed',
        event: 'operations.retention_cleanup.failed',
        message: 'Retention cleanup failed.',
      }),
    );
    process.exitCode = 1;
  });
}
