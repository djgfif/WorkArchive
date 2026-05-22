import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ExternalApiKeyCryptoService } from './external-api-key-crypto.service';
import { ImportsController } from './imports.controller';
import { ImportsCredentialService } from './imports-credential.service';
import { ImportsService } from './imports.service';
import { ProviderRuntimeStateService } from './provider-runtime-state.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [ImportsController],
  providers: [
    ExternalApiKeyCryptoService,
    ImportsCredentialService,
    ImportsService,
    ProviderRuntimeStateService,
  ],
  exports: [ImportsService],
})
export class ImportsModule {}
