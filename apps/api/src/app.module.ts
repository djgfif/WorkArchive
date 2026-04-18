import { Module } from '@nestjs/common';

import { HealthModule } from './modules/health/health.module';
import { SyncModule } from './modules/sync/sync.module';
import { WorksModule } from './modules/works/works.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, WorksModule, SyncModule],
})
export class AppModule {}
