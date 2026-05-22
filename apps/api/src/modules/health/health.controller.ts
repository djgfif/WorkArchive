import { Controller, Get, HttpCode, HttpStatus, Inject, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';

interface HealthResponse {
  service: string;
  status: 'ok';
}

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

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

    try {
      config = readApiRuntimeConfig();
    } catch (error) {
      failures.push('config');
      this.logReadyFailure('config', error);
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      failures.push('postgres');
      this.logReadyFailure('postgres', error);
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
