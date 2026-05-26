import { Inject, Injectable } from '@nestjs/common';

import type { PullSyncDto } from './dto/pull-sync.dto';
import type { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import type { PushSyncDto } from './dto/push-sync.dto';
import type { PushSyncResponseDto } from './dto/push-sync-response.dto';
import { SyncPullService } from './services/sync-pull.service';
import { SyncPushService } from './services/sync-push.service';

@Injectable()
export class SyncService {
  constructor(
    @Inject(SyncPushService) private readonly pushService: SyncPushService,
    @Inject(SyncPullService) private readonly pullService: SyncPullService,
  ) {}

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
