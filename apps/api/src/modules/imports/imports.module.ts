import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ExternalApiKeyCryptoService } from './credentials/external-api-key-crypto.service';
import { ImportsController } from './imports.controller';
import { ImportsCredentialService } from './credentials/imports-credential.service';
import { ImportsService } from './imports.service';
import { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';

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
