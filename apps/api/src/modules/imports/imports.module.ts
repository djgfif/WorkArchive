import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ExternalApiKeyCryptoService } from './external-api-key-crypto.service';
import { ImportsController } from './imports.controller';
import { ImportsCredentialService } from './imports-credential.service';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [
    ExternalApiKeyCryptoService,
    ImportsCredentialService,
    ImportsService,
  ],
  exports: [ImportsService],
})
export class ImportsModule {}
