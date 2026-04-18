import { Module } from '@nestjs/common';

import { HealthModule } from './modules/health/health.module';
import { WorksModule } from './modules/works/works.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, WorksModule],
})
export class AppModule {}
