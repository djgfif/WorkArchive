import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthFlowStoreService } from './google-oauth-flow-store.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SecurityModule } from '../../security/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthFlowStoreService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
