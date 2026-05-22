import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
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

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private localMigrationNames: string[] | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresReady = true;
    } catch (error) {
      failures.push('postgres');
      this.logReadyFailure('postgres', error);
    }

    if (postgresReady) {
      try {
        await this.assertMigrationsReady();
      } catch (error) {
        failures.push('migrations');
        this.logReadyFailure('migrations', error);
      }
    }

    if (config?.redisUrl) {
      const redis = new Redis(config.redisUrl, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      try {
        await redis.connect();
        await redis.ping();
      } catch (error) {
        failures.push('redis');
        this.logReadyFailure('redis', error);
      } finally {
        redis.disconnect();
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

    const migrationsDirectory = resolve(__dirname, '../../../prisma/migrations');

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

  private logReadyFailure(check: string, error: unknown) {
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
