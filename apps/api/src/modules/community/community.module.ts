import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommunityReflectionController } from './community-reflection.controller';
import { CommunityReleaseGuard } from './community-release-policy';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityDiscoveryService } from './services/community-discovery.service';
import { CommunityInteractionService } from './services/community-interaction.service';
import { CommunityModerationService } from './services/community-moderation.service';
import { CommunityProfileService } from './services/community-profile.service';
import { CommunityPublicationService } from './services/community-publication.service';
import { CommunityQueryService } from './services/community-query.service';

@Module({
  imports: [AuthModule],
  controllers: [CommunityController, CommunityReflectionController],
  providers: [
    CommunityDiscoveryService,
    CommunityInteractionService,
    CommunityModerationService,
    CommunityProfileService,
    CommunityPublicationService,
    CommunityQueryService,
    CommunityReleaseGuard,
    CommunityService,
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
