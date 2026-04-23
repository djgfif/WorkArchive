import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UserRecordsController } from './user-records.controller';
import { UserRecordsService } from './user-records.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [UserRecordsController],
  providers: [UserRecordsService],
  exports: [UserRecordsService],
})
export class UserRecordsModule {}
