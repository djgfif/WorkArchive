import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

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
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';
import { SyncIdempotencyService } from './sync-idempotency.service';
import { SyncPayloadValidationService } from './sync-payload-validation.service';
import {
  applyContributorChange,
  applySeriesChange,
  applyWorkContributorChange,
  applyWorkRelationChange,
  applyWorkSeriesLinkChange,
} from './sync-push.graph-handler';
import {
  applyTierBoardAssetChange,
  applyTierBoardCardChange,
  applyTierBoardChange,
  applyTierLaneChange,
} from './sync-push.tier-board-handler';
import { applyReleaseRecordChange } from './sync-push.release-record-handler';
import { applyTimelineEntryChange } from './sync-push.timeline-entry-handler';
import { applyWorkChange } from './sync-push.work-handler';
import {
  type StructuredLogFields,
} from './sync-push.shared';

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
    this.assertSupportedSchemaVersion(pushSyncDto);

    const { changes } = pushSyncDto;
    const sortedChanges = this.sortChangesByCreatedAt(changes);
    const results: PushSyncResultDto[] = [];
    const startedAt = Date.now();

    this.logEvent('sync.push.started', {
      count: changes.length,
      requestId,
      userId,
    });

    try {
      for (const change of sortedChanges) {
        results.push(await this.applyIdempotentChange(userId, change));
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
        errorCode: this.describeError(error),
        requestId,
        userId,
      });
      this.logger.warn(
        `Sync push failed userId=${userId} requested=${changes.length} reason=${this.describeError(error)}`,
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

  private logEvent(event: string, fields: StructuredLogFields) {
    this.logger.log(
      JSON.stringify({
        count: fields.count ?? null,
        durationMs: fields.durationMs ?? null,
        entityType: fields.entityType ?? null,
        errorCode: fields.errorCode ?? null,
        event,
        provider: fields.provider ?? null,
        requestId: fields.requestId ?? null,
        userId: fields.userId ?? null,
      }),
    );
  }

  private async applyChange(
    userId: string,
    change: PushSyncChangeDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PushSyncResultDto> {
    const payloadValidation =
      this.payloadValidationService.validateChangePayload(change);

    if (!payloadValidation.ok) {
      return payloadValidation.result;
    }

    if (change.entityType === 'series') {
      return applySeriesChange(
        userId,
        change,
        payloadValidation.payload as SyncSeriesPayloadDto,
        client,
      );
    }

    if (change.entityType === 'contributor') {
      return applyContributorChange(
        userId,
        change,
        payloadValidation.payload as SyncContributorPayloadDto,
        client,
      );
    }

    if (change.entityType === 'work_series_link') {
      return applyWorkSeriesLinkChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkSeriesLinkPayloadDto,
        client,
        this.userRecordsService,
      );
    }

    if (change.entityType === 'work_contributor') {
      return applyWorkContributorChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkContributorPayloadDto,
        client,
        this.userRecordsService,
      );
    }

    if (change.entityType === 'work_relation') {
      return applyWorkRelationChange(
        userId,
        change,
        payloadValidation.payload as SyncWorkRelationPayloadDto,
        client,
        this.userRecordsService,
      );
    }

    if (change.entityType === 'tier_board') {
      return applyTierBoardChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardPayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_lane') {
      return applyTierLaneChange(
        userId,
        change,
        payloadValidation.payload as SyncTierLanePayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_board_card') {
      return applyTierBoardCardChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardCardPayloadDto,
        client,
      );
    }

    if (change.entityType === 'tier_board_asset') {
      return applyTierBoardAssetChange(
        userId,
        change,
        payloadValidation.payload as SyncTierBoardAssetPayloadDto,
        client,
      );
    }

    if (change.entityType === 'timeline_entry') {
      return applyTimelineEntryChange(
        userId,
        change,
        payloadValidation.payload as SyncTimelineEntryPayloadDto,
        client,
        {
          timelineEntriesService: this.timelineEntriesService,
          userRecordsService: this.userRecordsService,
        },
      );
    }

    if (change.entityType === 'release_record') {
      return applyReleaseRecordChange(
        userId,
        change,
        payloadValidation.payload as SyncReleaseRecordPayloadDto,
        client,
        {
          releaseRecordsService: this.releaseRecordsService,
          userRecordsService: this.userRecordsService,
        },
      );
    }

    return applyWorkChange(
      userId,
      change,
      payloadValidation.payload as SyncWorkPayloadDto,
      client,
      {
        catalogService: this.catalogService,
        userRecordsService: this.userRecordsService,
      },
    );
  }

  private assertSupportedSchemaVersion({
    schemaVersion,
  }: {
    schemaVersion?: unknown;
  }) {
    if (schemaVersion === undefined) {
      return;
    }

    if (schemaVersion !== SYNC_SCHEMA_VERSION) {
      throw new BadRequestException(
        `Unsupported sync schema version "${String(schemaVersion)}". Supported version is ${SYNC_SCHEMA_VERSION}.`,
      );
    }
  }

  private sortChangesByCreatedAt(changes: PushSyncChangeDto[]) {
    return changes
      .map((change, index) => ({
        change,
        index,
        timestamp: Date.parse(change.createdAt),
      }))
      .sort((left, right) => {
        const timestampDelta = left.timestamp - right.timestamp;

        if (timestampDelta !== 0) {
          return timestampDelta;
        }

        return left.index - right.index;
      })
      .map(({ change }) => change);
  }

  private logPushSummary(
    userId: string,
    requestedCount: number,
    response: PushSyncResponseDto,
  ) {
    const appliedCount = response.results.filter(
      (result) => result.status === 'applied',
    ).length;
    const conflictCount = response.results.filter(
      (result) => result.status === 'conflict',
    ).length;
    const failedCount = response.results.filter(
      (result) => result.status === 'failed',
    ).length;

    this.logger.log(
      `Sync push summary userId=${userId} requested=${requestedCount} applied=${appliedCount} conflict=${conflictCount} failed=${failedCount}`,
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.name;
    }

    return 'UnknownError';
  }
}
