import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { MetricsService } from '../../../observability/metrics.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PullSyncDto } from '../dto/pull-sync.dto';
import type { PullSyncResponseDto } from '../dto/pull-sync-response.dto';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';
import { SyncCursorService } from './sync-cursor.service';
import { buildOrderedPullChanges } from './sync-pull.change-builders';
import { findRecordsForPullPage } from './sync-pull.page-loader';
import {
  assertSupportedSyncSchemaVersion,
  describeError,
  logStructuredSyncEvent,
  parseIsoDate,
  type StructuredLogFields,
} from './sync-service-utils';
import {
  countPullOperations,
  sortPullChangedRecordsByUpdatedAt,
} from './sync-summary-utils';

@Injectable()
export class SyncPullService {
  private readonly logger = new Logger(SyncPullService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SyncCursorService)
    private readonly cursorService: SyncCursorService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  async pull(
    userId: string,
    pullSyncDto: PullSyncDto,
    requestId?: string,
  ): Promise<PullSyncResponseDto> {
    assertSupportedSyncSchemaVersion(pullSyncDto);

    const { since } = pullSyncDto;
    const startedAt = Date.now();

    this.logEvent('sync.pull.started', {
      requestId,
      userId,
    });

    try {
      const parsedSince =
        since === undefined || since === null
          ? null
          : parseIsoDate(since, 'since');
      const parsedCursor = this.cursorService.parsePullCursor(
        pullSyncDto.cursor ?? null,
      );
      const pageLimit = this.cursorService.resolvePullLimit(pullSyncDto.limit);
      const queryLimit = pageLimit + 1;
      const records = await findRecordsForPullPage({
        cursor: parsedCursor,
        findPullPageCursorFilter:
          this.cursorService.findPullPageCursorFilter.bind(this.cursorService),
        prisma: this.prisma,
        since: parsedSince,
        take: queryLimit,
        userId,
      });
      const pulledAt = new Date().toISOString();
      const orderedChanges = buildOrderedPullChanges(
        records,
        this.cursorService.compareEntityIds.bind(this.cursorService),
      );
      const pagedChanges = orderedChanges.slice(0, pageLimit);
      const hasMore = orderedChanges.length > pagedChanges.length;
      const lastPagedChange = pagedChanges.at(-1) ?? null;
      const changes = pagedChanges.map((entry) => entry.change);
      const changedRecords = sortPullChangedRecordsByUpdatedAt(records);
      const response: PullSyncResponseDto = {
        schemaVersion: SYNC_SCHEMA_VERSION,
        pulledAt,
        nextSince: hasMore
          ? (since ?? null)
          : this.cursorService.buildNextSince(
              since ?? null,
              pulledAt,
              changedRecords,
            ),
        nextCursor:
          hasMore && lastPagedChange
            ? this.cursorService.encodePullCursor(lastPagedChange.cursor)
            : null,
        hasMore,
        changes,
      };

      this.logPullSummary(userId, since ?? null, response);
      this.metricsService?.recordSync('pull', 'success');
      this.metricsService?.recordSyncDuration(
        { direction: 'pull', result: 'success' },
        (Date.now() - startedAt) / 1000,
      );
      this.logEvent('sync.pull.completed', {
        count: response.changes.length,
        durationMs: Date.now() - startedAt,
        requestId,
        userId,
      });

      return response;
    } catch (error) {
      this.metricsService?.recordSync('pull', 'failure');
      this.metricsService?.recordSyncDuration(
        { direction: 'pull', result: 'failure' },
        (Date.now() - startedAt) / 1000,
      );
      this.logEvent('sync.pull.failed', {
        durationMs: Date.now() - startedAt,
        errorCode: describeError(error),
        requestId,
        userId,
      });
      throw error;
    }
  }

  private logEvent(event: string, fields: StructuredLogFields) {
    logStructuredSyncEvent(this.logger, event, fields);
  }

  private logPullSummary(
    userId: string,
    since: string | null,
    response: PullSyncResponseDto,
  ) {
    const { deleteCount, upsertCount } = countPullOperations(response.changes);

    this.logger.log(
      `Sync pull summary userId=${userId} since=${since ?? 'null'} changes=${response.changes.length} upsert=${upsertCount} delete=${deleteCount} nextSince=${response.nextSince}`,
    );
  }
}
