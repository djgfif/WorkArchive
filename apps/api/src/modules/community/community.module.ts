import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommunityReflectionController } from './community-reflection.controller';
import { CommunityReleaseGuard } from './community-release-policy';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [AuthModule],
  controllers: [CommunityController, CommunityReflectionController],
  providers: [CommunityReleaseGuard, CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
