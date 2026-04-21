import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { UserRecordsModule } from '../user-records/user-records.module';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  imports: [AuthModule, CatalogModule, UserRecordsModule],
  controllers: [WorksController],
  providers: [WorksService],
})
export class WorksModule {}
