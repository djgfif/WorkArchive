import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_SECURITY_EVENT_RETENTION_DAYS = 180;
const DEFAULT_REVOKED_REFRESH_SESSION_RETENTION_DAYS = 30;
const DEFAULT_EXPIRED_REFRESH_SESSION_RETENTION_DAYS = 30;
const PRODUCTION_CONFIRMATION = 'delete-expired-operational-data';

type RetentionWhere = Record<string, unknown>;

interface RetentionModelDelegate {
  count(input: { where: RetentionWhere }): Promise<number>;
  deleteMany(input: { where: RetentionWhere }): Promise<{ count: number }>;
}

export interface RetentionPrismaClient {
  securityEvent: RetentionModelDelegate;
  userSyncAppliedMutation: RetentionModelDelegate;
  userRefreshSession: RetentionModelDelegate;
}

export interface RetentionCleanupConfig {
  dryRun: boolean;
  expiredRefreshSessionRetentionDays: number;
  now: Date;
  productionConfirmation: string | null;
  revokedRefreshSessionRetentionDays: number;
  securityEventRetentionDays: number;
}

export interface RetentionCleanupTarget {
  description: string;
  model: keyof RetentionPrismaClient;
  name: string;
  where: RetentionWhere;
}

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

export function readRetentionCleanupConfig(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): RetentionCleanupConfig {
  return {
    dryRun: readBoolean(env.RETENTION_CLEANUP_DRY_RUN, true),
    expiredRefreshSessionRetentionDays: readPositiveInteger(
      env.RETENTION_EXPIRED_REFRESH_SESSION_DAYS,
      DEFAULT_EXPIRED_REFRESH_SESSION_RETENTION_DAYS,
    ),
    now,
    productionConfirmation: env.RETENTION_CLEANUP_CONFIRM?.trim() || null,
    revokedRefreshSessionRetentionDays: readPositiveInteger(
      env.RETENTION_REVOKED_REFRESH_SESSION_DAYS,
      DEFAULT_REVOKED_REFRESH_SESSION_RETENTION_DAYS,
    ),
    securityEventRetentionDays: readPositiveInteger(
      env.RETENTION_SECURITY_EVENT_DAYS,
      DEFAULT_SECURITY_EVENT_RETENTION_DAYS,
    ),
  };
}

export function assertRetentionCleanupCanRun(
  config: RetentionCleanupConfig,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (
    env.NODE_ENV?.trim() === 'production' &&
    !config.dryRun &&
    config.productionConfirmation !== PRODUCTION_CONFIRMATION
  ) {
    throw new Error(
      `Production retention cleanup requires RETENTION_CLEANUP_CONFIRM=${PRODUCTION_CONFIRMATION}.`,
    );
  }
}

export function buildRetentionCleanupTargets(
  config: RetentionCleanupConfig,
): RetentionCleanupTarget[] {
  const securityEventCutoff = subtractDays(
    config.now,
    config.securityEventRetentionDays,
  );
  const revokedSessionCutoff = subtractDays(
    config.now,
    config.revokedRefreshSessionRetentionDays,
  );
  const expiredSessionCutoff = subtractDays(
    config.now,
    config.expiredRefreshSessionRetentionDays,
  );

  return [
    {
      description: `security_events created before ${securityEventCutoff.toISOString()}`,
      model: 'securityEvent',
      name: 'security_events',
      where: {
        createdAt: {
          lt: securityEventCutoff,
        },
      },
    },
    {
      description:
        'user_refresh_sessions revoked or expired beyond retention cutoffs',
      model: 'userRefreshSession',
      name: 'user_refresh_sessions',
      where: {
        OR: [
          {
            revokedAt: {
              lt: revokedSessionCutoff,
              not: null,
            },
          },
          {
            expiresAt: {
              lt: expiredSessionCutoff,
            },
          },
        ],
      },
    },
    {
      description: `user_sync_applied_mutations replay rows expired before ${config.now.toISOString()}`,
      model: 'userSyncAppliedMutation',
      name: 'user_sync_applied_mutations',
      where: {
        expiresAt: {
          lt: config.now,
          not: null,
        },
      },
    },
  ];
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

function readBoolean(value: string | undefined, defaultValue: boolean) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalizedValue);
}

function readPositiveInteger(value: string | undefined, defaultValue: number) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`Retention days must be a positive integer: ${value}`);
  }

  return parsedValue;
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1_000);
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
