import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { UserRecordsModule } from '../user-records/user-records.module';
import { GraphSyncHandler } from './handlers/graph-sync.handler';
import { ReleaseRecordSyncHandler } from './handlers/release-record-sync.handler';
import { TierBoardSyncHandler } from './handlers/tier-board-sync.handler';
import { TimelineEntrySyncHandler } from './handlers/timeline-entry-sync.handler';
import { WorkSyncHandler } from './handlers/work-sync.handler';
import { SyncCursorService } from './services/sync-cursor.service';
import { SyncIdempotencyService } from './services/sync-idempotency.service';
import { SyncPayloadValidationService } from './services/sync-payload-validation.service';
import { SyncPullService } from './services/sync-pull.service';
import { SyncPushService } from './services/sync-push.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule, CatalogModule, UserRecordsModule],
  controllers: [SyncController],
  providers: [
    GraphSyncHandler,
    ReleaseRecordSyncHandler,
    SyncCursorService,
    SyncIdempotencyService,
    SyncPayloadValidationService,
    SyncPullService,
    SyncPushService,
    SyncService,
    TierBoardSyncHandler,
    TimelineEntrySyncHandler,
    WorkSyncHandler,
  ],
})
export class SyncModule {}
