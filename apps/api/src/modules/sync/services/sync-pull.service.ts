import { Inject, Injectable } from '@nestjs/common';

import type { PullSyncDto } from '../dto/pull-sync.dto';
import type { PullSyncResponseDto } from '../dto/pull-sync-response.dto';
import { SyncPushService } from './sync-push.service';

@Injectable()
export class SyncPullService {
  constructor(
    @Inject(SyncPushService) private readonly syncPushService: SyncPushService,
  ) {}

  pull(
    userId: string,
    pullSyncDto: PullSyncDto,
    requestId?: string,
  ): Promise<PullSyncResponseDto> {
    return this.syncPushService.pull(userId, pullSyncDto, requestId);
  }
}
