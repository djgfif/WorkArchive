import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UserReleaseRecordsController } from './user-release-records.controller';
import { UserReleaseRecordsService } from './user-release-records.service';
import { UserRecordsController } from './user-records.controller';
import { UserRecordsService } from './user-records.service';
import { UserTimelineEntriesService } from './user-timeline-entries.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [UserRecordsController, UserReleaseRecordsController],
  providers: [
    UserRecordsService,
    UserReleaseRecordsService,
    UserTimelineEntriesService,
  ],
  exports: [
    UserRecordsService,
    UserReleaseRecordsService,
    UserTimelineEntriesService,
  ],
})
export class UserRecordsModule {}
