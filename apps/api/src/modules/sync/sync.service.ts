import { Inject, Injectable, Optional } from '@nestjs/common';

import type { CatalogService } from '../catalog/catalog.service';
import { MetricsService } from '../../observability/metrics.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { UserReleaseRecordsService } from '../user-records/user-release-records.service';
import { UserRecordsService } from '../user-records/user-records.service';
import { UserTimelineEntriesService } from '../user-records/user-timeline-entries.service';
import type { PullSyncDto } from './dto/pull-sync.dto';
import type { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import type { PushSyncDto } from './dto/push-sync.dto';
import type { PushSyncResponseDto } from './dto/push-sync-response.dto';
import { SyncPullService } from './services/sync-pull.service';
import { SyncPushService } from './services/sync-push.service';

@Injectable()
export class SyncService {
  private readonly pullService: SyncPullService;
  private readonly pushService: SyncPushService;

  constructor(
    @Inject(SyncPushService)
    pushServiceOrPrisma: SyncPushService | PrismaService,
    @Inject(SyncPullService)
    pullServiceOrCatalog: SyncPullService | CatalogService,
    @Inject(UserRecordsService)
    @Optional()
    userRecordsService?: UserRecordsService,
    @Inject(UserReleaseRecordsService)
    @Optional()
    releaseRecordsService?: UserReleaseRecordsService,
    @Inject(UserTimelineEntriesService)
    @Optional()
    timelineEntriesService?: UserTimelineEntriesService,
    @Inject(MetricsService)
    @Optional()
    metricsService?: MetricsService,
  ) {
    if (
      pushServiceOrPrisma instanceof SyncPushService &&
      pullServiceOrCatalog instanceof SyncPullService
    ) {
      this.pushService = pushServiceOrPrisma;
      this.pullService = pullServiceOrCatalog;
      return;
    }

    this.pushService = new SyncPushService(
      pushServiceOrPrisma as PrismaService,
      pullServiceOrCatalog as CatalogService,
      userRecordsService as UserRecordsService,
      releaseRecordsService as UserReleaseRecordsService,
      timelineEntriesService as UserTimelineEntriesService,
      metricsService,
    );
    this.pullService = new SyncPullService(this.pushService);
  }

  push(
    userId: string,
    pushSyncDto: PushSyncDto,
    requestId?: string,
  ): Promise<PushSyncResponseDto> {
    return this.pushService.push(userId, pushSyncDto, requestId);
  }

  pull(
    userId: string,
    pullSyncDto: PullSyncDto,
    requestId?: string,
  ): Promise<PullSyncResponseDto> {
    return this.pullService.pull(userId, pullSyncDto, requestId);
  }
}
