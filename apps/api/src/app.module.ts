import 'dotenv/config';

import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { SyncModule } from './modules/sync/sync.module';
import { UserRecordsModule } from './modules/user-records/user-records.module';
import { WorksModule } from './modules/works/works.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    UserRecordsModule,
    ImportsModule,
    WorksModule,
    SyncModule,
  ],
})
export class AppModule {}
