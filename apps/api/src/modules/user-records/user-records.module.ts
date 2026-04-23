import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UserReleaseRecordsController } from './user-release-records.controller';
import { UserReleaseRecordsService } from './user-release-records.service';
import { UserRecordsController } from './user-records.controller';
import { UserRecordsService } from './user-records.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [UserRecordsController, UserReleaseRecordsController],
  providers: [UserRecordsService, UserReleaseRecordsService],
  exports: [UserRecordsService, UserReleaseRecordsService],
})
export class UserRecordsModule {}
