import { Module } from '@nestjs/common';

import { AppFeatureModule } from './modules/app/app.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AppFeatureModule],
})
export class AppModule {}
