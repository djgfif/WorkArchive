import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { UserRecordsModule } from '../user-records/user-records.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule, CatalogModule, UserRecordsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
