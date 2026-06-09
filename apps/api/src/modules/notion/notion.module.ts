import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ExternalApiKeyCryptoService } from '../imports/credentials/external-api-key-crypto.service';
import { UserRecordsModule } from '../user-records';
import { NotionController } from './notion.controller';
import { NotionService } from './notion.service';

@Module({
  imports: [AuthModule, CatalogModule, UserRecordsModule],
  controllers: [NotionController],
  providers: [ExternalApiKeyCryptoService, NotionService],
})
export class NotionModule {}
