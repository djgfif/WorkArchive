import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { SecurityAuditService } from './security-audit.service';
import { SecurityRuntimeCleanupService } from './security-runtime-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [SecurityAuditService, SecurityRuntimeCleanupService],
  exports: [SecurityAuditService],
})
export class SecurityModule {}
