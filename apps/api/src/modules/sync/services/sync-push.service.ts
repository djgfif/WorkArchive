import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { CatalogService } from '../../catalog/catalog.service';
import { UserReleaseRecordsService } from '../../user-records/user-release-records.service';
import { UserRecordsService } from '../../user-records/user-records.service';
import { UserTimelineEntriesService } from '../../user-records/user-timeline-entries.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MetricsService } from '../../../observability/metrics.service';
import type { PushSyncChangeDto, PushSyncDto } from '../dto/push-sync.dto';
import type {
  PushSyncResponseDto,
  PushSyncResultDto,
} from '../dto/push-sync-response.dto';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';
import { SyncIdempotencyService } from './sync-idempotency.service';
import { SyncPayloadValidationService } from './sync-payload-validation.service';
import {
  applyValidatedPushChange,
  type SyncPushChangeDependencies,
} from './sync-push.change-dispatcher';
import type { SyncPushClient } from './sync-push.client';
import {
  assertSupportedSyncSchemaVersion,
  describeError,
  logStructuredSyncEvent,
  type StructuredLogFields,
} from './sync-service-utils';
import {
  countPushResultStatuses,
  sortPushChangesByCreatedAt,
} from './sync-summary-utils';

@Injectable()
export class SyncPushService {
  private readonly logger = new Logger(SyncPushService.name);
  private readonly idempotencyService: SyncIdempotencyService;
  private readonly payloadValidationService: SyncPayloadValidationService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
    @Inject(UserTimelineEntriesService)
    private readonly timelineEntriesService: UserTimelineEntriesService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
    @Inject(SyncIdempotencyService)
    @Optional()
    idempotencyService?: SyncIdempotencyService,
    @Inject(SyncPayloadValidationService)
    @Optional()
    payloadValidationService?: SyncPayloadValidationService,
  ) {
    this.idempotencyService =
      idempotencyService ?? new SyncIdempotencyService(this.prisma);
    this.payloadValidationService =
      payloadValidationService ?? new SyncPayloadValidationService();
  }

  async push(
    userId: string,
    pushSyncDto: PushSyncDto,
    requestId?: string,
  ): Promise<PushSyncResponseDto> {
    assertSupportedSyncSchemaVersion(pushSyncDto);

    const { changes } = pushSyncDto;
    const sortedChanges = sortPushChangesByCreatedAt(changes);
    const results: PushSyncResultDto[] = [];
    const startedAt = Date.now();

    this.logEvent('sync.push.started', {
      count: changes.length,
      requestId,
      userId,
    });

    try {
      for (const change of sortedChanges) {
        results.push(
          await this.applyChangeAsResult(userId, change, requestId),
        );
      }

      const response = {
        processedAt: new Date().toISOString(),
        results,
        schemaVersion: SYNC_SCHEMA_VERSION,
      };

      this.logPushSummary(userId, changes.length, response);
      this.metricsService?.recordSync('push', 'success');
      this.logEvent('sync.push.completed', {
        count: response.results.length,
        durationMs: Date.now() - startedAt,
        requestId,
        userId,
      });

      return response;
    } catch (error) {
      this.metricsService?.recordSync('push', 'failure');
      this.logEvent('sync.push.failed', {
        count: changes.length,
        durationMs: Date.now() - startedAt,
        errorCode: describeError(error),
        requestId,
        userId,
      });
      this.logger.warn(
        `Sync push failed userId=${userId} requested=${changes.length} reason=${describeError(error)}`,
      );
      throw error;
    }
  }

  private async applyIdempotentChange(
    userId: string,
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    return this.idempotencyService.applyIdempotentChange(
      userId,
      change,
      (tx) => this.applyChange(userId, change, tx),
      (result) => {
        this.metricsService?.recordSyncResult(
          change.entityType,
          result.status,
          result.code ?? 'unknown',
        );

        if (result.status === 'conflict') {
          this.logEvent('sync.conflict.detected', {
            entityType: change.entityType,
            errorCode: result.code,
            userId,
          });
        }
      },
    );
  }

  private async applyChangeAsResult(
    userId: string,
    change: PushSyncChangeDto,
    requestId?: string,
  ): Promise<PushSyncResultDto> {
    try {
      return await this.applyIdempotentChange(userId, change);
    } catch (error) {
      const result = this.buildUnexpectedChangeFailure(change);

      this.metricsService?.recordSyncResult(
        change.entityType,
        result.status,
        result.code ?? 'unknown',
      );
      this.logEvent('sync.change.failed', {
        entityType: change.entityType,
        errorCode: describeError(error),
        requestId,
        userId,
      });
      this.logger.warn(
        `Sync change failed userId=${userId} entityType=${change.entityType} entityId=${change.entityId} queueId=${change.queueId} reason=${describeError(error)}`,
      );

      return result;
    }
  }

  private buildUnexpectedChangeFailure(
    change: PushSyncChangeDto,
  ): PushSyncResultDto {
    return {
      code: 'failed_server_error',
      entityId: change.entityId,
      entityType: change.entityType,
      message:
        'Queued change failed while applying on the server. Retry sync after the server is healthy.',
      queueId: change.queueId,
      status: 'failed',
    };
  }

  private logEvent(event: string, fields: StructuredLogFields) {
    logStructuredSyncEvent(this.logger, event, fields);
  }

  private async applyChange(
    userId: string,
    change: PushSyncChangeDto,
    client: SyncPushClient = this.prisma,
  ): Promise<PushSyncResultDto> {
    const payloadValidation =
      this.payloadValidationService.validateChangePayload(change);

    if (!payloadValidation.ok) {
      return payloadValidation.result;
    }

    return applyValidatedPushChange(
      userId,
      change,
      payloadValidation.payload,
      client,
      this.getChangeDependencies(),
    );
  }

  private getChangeDependencies(): SyncPushChangeDependencies {
    return {
      catalogService: this.catalogService,
      releaseRecordsService: this.releaseRecordsService,
      timelineEntriesService: this.timelineEntriesService,
      userRecordsService: this.userRecordsService,
    };
  }

  private logPushSummary(
    userId: string,
    requestedCount: number,
    response: PushSyncResponseDto,
  ) {
    const { appliedCount, conflictCount, failedCount } =
      countPushResultStatuses(response.results);

    this.logger.log(
      `Sync push summary userId=${userId} requested=${requestedCount} applied=${appliedCount} conflict=${conflictCount} failed=${failedCount}`,
    );
  }
}
