import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CommunityProfileView } from '@work-archive/shared-types';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { extractOptionalBearerAccessToken } from '../auth/bearer-token';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CommunityModerationActionDto,
  CommunityCommentsQueryDto,
  CommunityFeedQueryDto,
  CommunityPostsQueryDto,
  CreateCommunityCommentDto,
  CreateCommunityPostDto,
  CreateCommunityReportDto,
  ResolveCommunityReportDto,
  UpdateCommunityCommentDto,
  UpdateCommunityProfileDto,
  UpsertCommunityReviewDto,
} from './dto/community.dto';
import { CommunityDiscoveryService } from './services/community-discovery.service';
import { CommunityInteractionService } from './services/community-interaction.service';
import { CommunityModerationService } from './services/community-moderation.service';
import { CommunityProfileService } from './services/community-profile.service';
import { CommunityPublicationService } from './services/community-publication.service';
import { CommunityQueryService } from './services/community-query.service';
import {
  CommunityReleaseGuard,
  isCommunityReleaseEnabled,
  readProductReleaseProfile,
  RequireCommunityRelease,
} from './community-release-policy';

@ApiTags('community')
@ApiExtraModels(
  CommunityCommentsQueryDto,
  CommunityFeedQueryDto,
  CommunityPostsQueryDto,
  UpdateCommunityCommentDto,
  UpdateCommunityProfileDto,
)
@Controller('community')
@RequireCommunityRelease('core')
@UseGuards(CommunityReleaseGuard)
export class CommunityController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CommunityDiscoveryService)
    private readonly discovery: CommunityDiscoveryService,
    @Inject(CommunityInteractionService)
    private readonly interactions: CommunityInteractionService,
    @Inject(CommunityModerationService)
    private readonly moderation: CommunityModerationService,
    @Inject(CommunityProfileService)
    private readonly profiles: CommunityProfileService,
    @Inject(CommunityPublicationService)
    private readonly publication: CommunityPublicationService,
    @Inject(CommunityQueryService)
    private readonly queries: CommunityQueryService,
  ) {}

  @Get('posts')
  @ApiOkResponse({ description: 'List visible Community posts.' })
  async listPosts(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityPostsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);

    return this.queries.listPosts(query, user?.userId ?? null);
  }

  @Get('feed')
  @ApiOkResponse({
    description: 'List the combined public review and board feed.',
  })
  async listFeed(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityFeedQueryDto,
  ) {
    if (
      query.scope === 'following' &&
      !isCommunityReleaseEnabled(readProductReleaseProfile(), 'full')
    ) {
      throw new NotFoundException();
    }
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.listFeed(query, user?.userId ?? null);
  }

  @Get('works/trending')
  @ApiOkResponse({ description: 'List works with recent Community activity.' })
  listTrendingWorks() {
    return this.queries.listTrendingWorks();
  }

  @Get('posts/:id')
  @ApiOkResponse({ description: 'Return one visible board post.' })
  async getPost(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.getPost(id, user?.userId ?? null);
  }

  @Post('posts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityPostDto })
  @ApiCreatedResponse({ description: 'Publish a new Community post.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCommunityPostDto,
  ) {
    return this.publication.createPost(user.userId, input);
  }

  @Get('works/:catalogTitleId/reviews')
  @ApiOkResponse({ description: 'List public reviews for one catalog title.' })
  async listReviewsByWork(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('catalogTitleId', new ParseUUIDPipe()) catalogTitleId: string,
    @Query() query: CommunityPostsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.listReviewsByWork(
      catalogTitleId,
      query,
      user?.userId ?? null,
    );
  }

  @Get('reviews/:id')
  @ApiOkResponse({ description: 'Return one visible Community review.' })
  async getReview(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.getReview(id, user?.userId ?? null);
  }

  @Put('reviews/:catalogTitleId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpsertCommunityReviewDto })
  upsertReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('catalogTitleId', new ParseUUIDPipe()) catalogTitleId: string,
    @Body() input: UpsertCommunityReviewDto,
  ) {
    return this.publication.upsertReview(user.userId, catalogTitleId, input);
  }

  @Delete('reviews/:catalogTitleId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('catalogTitleId', new ParseUUIDPipe()) catalogTitleId: string,
  ) {
    return this.publication.deleteReview(user.userId, catalogTitleId);
  }

  @Get('comments')
  async listComments(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityCommentsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.listComments(
      query.targetType,
      query.targetId,
      user?.userId ?? null,
    );
  }

  @Post('comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityCommentDto })
  createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCommunityCommentDto,
  ) {
    return this.publication.createComment(user.userId, input);
  }

  @Patch('comments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpdateCommunityCommentDto })
  updateComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateCommunityCommentDto,
  ) {
    return this.publication.updateComment(user.userId, id, input);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.publication.deleteComment(user.userId, id);
  }

  @Put('reactions/:targetType/:targetId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addTargetReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType') targetType: string,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
  ) {
    return this.interactions.setTargetReaction(
      user.userId,
      this.parseReactionTarget(targetType),
      targetId,
      true,
    );
  }

  @Delete('reactions/:targetType/:targetId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeTargetReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType') targetType: string,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
  ) {
    return this.interactions.setTargetReaction(
      user.userId,
      this.parseReactionTarget(targetType),
      targetId,
      false,
    );
  }

  @Get('profiles/:handle')
  async getProfile(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('handle') handle: string,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    const profile = await this.profiles.getProfile(
      handle,
      user?.userId ?? null,
    );
    return this.restrictProfileToRelease(profile);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpdateCommunityProfileDto })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateCommunityProfileDto,
  ) {
    const releaseInput = this.isFullRelease()
      ? input
      : {
          ...input,
          allowFollowers: false,
          notifications: {
            browser: false,
            globalBadge: false,
            inCommunity: false,
          },
          sections: {
            ...input.sections,
            showFollowers: false,
            showTasteSummary: false,
          },
        };
    const profile = await this.profiles.updateProfile(
      user.userId,
      releaseInput,
    );
    return this.restrictProfileToRelease(profile);
  }

  @Put('profiles/:handle/follow')
  @RequireCommunityRelease('full')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  followProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('handle') handle: string,
  ) {
    return this.interactions.setFollow(user.userId, handle, true);
  }

  @Delete('profiles/:handle/follow')
  @RequireCommunityRelease('full')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unfollowProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('handle') handle: string,
  ) {
    return this.interactions.setFollow(user.userId, handle, false);
  }

  @Get('taste/candidates')
  @RequireCommunityRelease('full')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listTasteCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.discovery.listTasteCandidates(user.userId);
  }

  @Get('notifications')
  @RequireCommunityRelease('full')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.discovery.listNotifications(user.userId);
  }

  @Post('notifications/read')
  @RequireCommunityRelease('full')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  markNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.discovery.markNotificationsRead(user.userId);
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Soft-delete the current author post.' })
  deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.publication.deletePost(user.userId, id);
  }

  @Post('posts/:id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Add the current user reaction.' })
  addReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.interactions.addReaction(user.userId, id);
  }

  @Delete('posts/:id/reactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Remove the current user reaction.' })
  removeReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.interactions.removeReaction(user.userId, id);
  }

  @Post('posts/:id/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityReportDto })
  @ApiCreatedResponse({ description: 'Report a visible Community post.' })
  reportPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateCommunityReportDto,
  ) {
    return this.moderation.reportPost(user.userId, id, input);
  }

  @Post('reviews/:id/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityReportDto })
  @ApiCreatedResponse({ description: 'Report a visible Community review.' })
  reportReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateCommunityReportDto,
  ) {
    return this.moderation.reportReview(user.userId, id, input);
  }

  @Post('comments/:id/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityReportDto })
  @ApiCreatedResponse({ description: 'Report a visible Community comment.' })
  reportComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateCommunityReportDto,
  ) {
    return this.moderation.reportComment(user.userId, id, input);
  }

  @Get('moderation/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'List pending Community reports.' })
  listReports(@CurrentUser() user: AuthenticatedUser) {
    return this.moderation.listReports(user);
  }

  @Post('moderation/posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  @ApiOkResponse({ description: 'Hide a Community post with an audit row.' })
  hidePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.hidePost(user, id, input.note);
  }

  @Post('moderation/posts/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  @ApiOkResponse({ description: 'Restore a hidden post with an audit row.' })
  restorePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.restorePost(user, id, input.note);
  }

  @Post('moderation/reviews/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  hideReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.hideReview(user, id, input.note);
  }

  @Post('moderation/reviews/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  restoreReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.restoreReview(user, id, input.note);
  }

  @Post('moderation/comments/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  hideComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.hideComment(user, id, input.note);
  }

  @Post('moderation/comments/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  restoreComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.restoreComment(user, id, input.note);
  }

  @Post('moderation/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: ResolveCommunityReportDto })
  @ApiOkResponse({
    description: 'Resolve or dismiss a report with an audit row.',
  })
  resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ResolveCommunityReportDto,
  ) {
    return this.moderation.resolveReport(user, id, input);
  }

  private isFullRelease() {
    return isCommunityReleaseEnabled(readProductReleaseProfile(), 'full');
  }

  private restrictProfileToRelease(
    profile: CommunityProfileView,
  ): CommunityProfileView {
    if (this.isFullRelease()) return profile;

    return {
      ...profile,
      allowFollowers: false,
      favoriteGenres: [],
      followerCount: 0,
      followingCount: 0,
      notifications: {
        browser: false,
        globalBadge: false,
        inCommunity: false,
      },
      sections: {
        ...profile.sections,
        showFollowers: false,
        showTasteSummary: false,
      },
      viewerCanFollow: false,
      viewerIsFollowing: false,
    };
  }

  private async getOptionalUser(authorizationHeader?: string) {
    const accessToken = extractOptionalBearerAccessToken(authorizationHeader);

    if (!accessToken) {
      return null;
    }

    return this.authService.validateAccessToken(accessToken);
  }

  private parseReactionTarget(value: string): 'comment' | 'review' {
    if (value !== 'comment' && value !== 'review') {
      throw new BadRequestException('targetType must be comment or review.');
    }
    return value;
  }
}
