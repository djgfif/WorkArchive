import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  connectRedisClient,
  type RedisClient,
} from '../../common/redis-client';
import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';

interface HealthResponse {
  service: string;
  status: 'ok';
}

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
  async getReadiness(): Promise<HealthResponse> {
    const failures: string[] = [];
    let config: ReturnType<typeof readApiRuntimeConfig> | null = null;
    let postgresReady = false;

    try {
      config = readApiRuntimeConfig();
    } catch (error) {
      failures.push('config');
      this.logReadyFailure('config', error);
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
    } catch (error) {
      failures.push('postgres');
      this.logReadyFailure('postgres', error);
    }

    if (postgresReady) {
      try {
        await this.withReadyTimeout(
          'migrations',
          this.assertMigrationsReady(),
          timeoutMs,
        );
      } catch (error) {
        failures.push('migrations');
        this.logReadyFailure('migrations', error);
      }
    }

    if (config?.redisUrl) {
      let redis: RedisClient | null = null;

      try {
        redis = await connectRedisClient(config.redisUrl, { timeoutMs });
      } catch (error) {
        failures.push('redis');
        this.logReadyFailure('redis', error);
      } finally {
        redis?.disconnect();
      }
    }

    if (failures.length > 0) {
      throw new ServiceUnavailableException({
        service: 'work-archive-api',
        status: 'unavailable',
        checks: failures,
      });
    }

    return this.getHealth();
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

  private logReadyFailure(check: string, error: unknown) {
    this.metricsService?.recordReadyzFailure(check);
    this.logger.warn(
      JSON.stringify({
        count: null,
        durationMs: null,
        entityType: check,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
        event: 'health.ready.failed',
        provider: null,
        requestId: null,
        userId: null,
      }),
    );
  }
}
