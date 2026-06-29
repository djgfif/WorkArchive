import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Optional,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Request } from 'express';

import {
  connectRedisClient,
  type RedisClient,
} from '../../common/redis-client';
import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestId } from '../../security/security-audit.service';

interface HealthResponse {
  service: string;
  status: 'ok';
}

type ReadinessCheckName = 'config' | 'migrations' | 'postgres' | 'redis';

type ReadinessResponse = HealthResponse & {
  checks: Partial<Record<ReadinessCheckName, 'ok'>>;
};

type ReadinessFailureResponse = {
  service: string;
  status: 'unavailable';
  checks: ReadinessCheckName[];
  requestId: string | null;
};

interface FailedMigrationCountRow {
  failedCount: bigint | number | string;
}

interface AppliedMigrationRow {
  migrationName: string;
}

const MIGRATIONS_RELATIVE_PATH = 'prisma/migrations';
const FALLBACK_READINESS_CHECK_TIMEOUT_MS = 1500;

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private localMigrationNames: string[] | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  @Get('health')
  getHealth(): HealthResponse {
    return {
      service: 'work-archive-api',
      status: 'ok',
    };
  }

  @Get('livez')
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  @Get('readyz')
  @HttpCode(HttpStatus.OK)
  async getReadiness(@Req() request?: Request): Promise<ReadinessResponse> {
    const failures: ReadinessCheckName[] = [];
    const checks: ReadinessResponse['checks'] = {};
    let config: ReturnType<typeof readApiRuntimeConfig> | null = null;
    let postgresReady = false;
    const requestId = getRequestId(request);

    try {
      config = readApiRuntimeConfig();
      checks.config = 'ok';
    } catch (error) {
      failures.push('config');
      this.logReadyFailure('config', error, requestId);
    }

    const timeoutMs =
      config?.readinessCheckTimeoutMs ?? FALLBACK_READINESS_CHECK_TIMEOUT_MS;

    try {
      await this.withReadyTimeout(
        'postgres',
        this.prisma.$queryRaw`SELECT 1`,
        timeoutMs,
      );
      postgresReady = true;
      checks.postgres = 'ok';
    } catch (error) {
      failures.push('postgres');
      this.logReadyFailure('postgres', error, requestId);
    }

    if (postgresReady) {
      try {
        await this.withReadyTimeout(
          'migrations',
          this.assertMigrationsReady(),
          timeoutMs,
        );
        checks.migrations = 'ok';
      } catch (error) {
        failures.push('migrations');
        this.logReadyFailure('migrations', error, requestId);
      }
    }

    if (config?.redisUrl) {
      let redis: RedisClient | null = null;

      try {
        redis = await connectRedisClient(config.redisUrl, { timeoutMs });
        checks.redis = 'ok';
      } catch (error) {
        failures.push('redis');
        this.logReadyFailure('redis', error, requestId);
      } finally {
        redis?.disconnect();
      }
    }

    if (failures.length > 0) {
      const response: ReadinessFailureResponse = {
        service: 'work-archive-api',
        status: 'unavailable',
        checks: failures,
        requestId,
      };

      throw new ServiceUnavailableException(response);
    }

    return {
      ...this.getHealth(),
      checks,
    };
  }

  private async assertMigrationsReady() {
    const failedRows = await this.prisma.$queryRaw<FailedMigrationCountRow[]>`
      SELECT COUNT(*)::int AS "failedCount"
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    const failedCount = Number(failedRows[0]?.failedCount ?? 0);

    if (!Number.isInteger(failedCount) || failedCount > 0) {
      throw new Error('Prisma migrations include unfinished records.');
    }

    const localMigrationNames = this.getLocalMigrationNames();
    const appliedRows = await this.prisma.$queryRaw<AppliedMigrationRow[]>`
      SELECT migration_name AS "migrationName"
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `;
    const appliedMigrationNames = new Set(
      appliedRows.map((row) => row.migrationName),
    );
    const missingMigrationNames = localMigrationNames.filter(
      (migrationName) => !appliedMigrationNames.has(migrationName),
    );

    if (missingMigrationNames.length > 0) {
      throw new Error(
        `Prisma migrations are pending: ${missingMigrationNames.join(', ')}`,
      );
    }
  }

  private getLocalMigrationNames() {
    if (this.localMigrationNames) {
      return this.localMigrationNames;
    }

    const migrationsDirectory = this.resolveMigrationsDirectory();

    if (!existsSync(migrationsDirectory)) {
      throw new Error('Prisma migrations directory is missing.');
    }

    const migrationNames = readdirSync(migrationsDirectory, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (migrationNames.length === 0) {
      throw new Error('Prisma migrations directory is empty.');
    }

    this.localMigrationNames = migrationNames;

    return migrationNames;
  }

  private resolveMigrationsDirectory() {
    const defaultDirectory = resolve(process.cwd(), MIGRATIONS_RELATIVE_PATH);
    const candidates = [
      defaultDirectory,
      resolve(process.cwd(), 'apps/api', MIGRATIONS_RELATIVE_PATH),
      resolve(__dirname, '../../../', MIGRATIONS_RELATIVE_PATH),
    ];

    return (
      candidates.find((candidate) => existsSync(candidate)) ?? defaultDirectory
    );
  }

  private async withReadyTimeout<T>(
    check: string,
    operation: Promise<T>,
    timeoutMs: number,
  ) {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`${check} readiness timed out after ${timeoutMs}ms.`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private logReadyFailure(
    check: string,
    error: unknown,
    requestId: string | null,
  ) {
    this.metricsService?.recordReadyzFailure(check);
    this.logger.warn(
      JSON.stringify({
        count: null,
        durationMs: null,
        entityType: check,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
        event: 'health.ready.failed',
        provider: null,
        requestId,
        userId: null,
      }),
    );
  }
}
