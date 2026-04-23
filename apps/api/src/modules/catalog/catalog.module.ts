import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogController } from './catalog.controller';
import { CatalogIngestionService } from './catalog-ingestion.service';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogIngestionService],
  exports: [CatalogService, CatalogIngestionService],
})
export class CatalogModule {}
