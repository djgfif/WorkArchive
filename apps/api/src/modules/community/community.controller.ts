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
import { CommunityService } from './community.service';
import {
  CommunityReleaseGuard,
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
@RequireCommunityRelease('social')
@UseGuards(CommunityReleaseGuard)
export class CommunityController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CommunityService)
    private readonly communityService: CommunityService,
  ) {}

  @Get('posts')
  @ApiOkResponse({ description: 'List visible Community posts.' })
  async listPosts(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityPostsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);

    return this.communityService.listPosts(query, user?.userId ?? null);
  }

  @Get('feed')
  @ApiOkResponse({ description: 'List the combined public review and board feed.' })
  async listFeed(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityFeedQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.communityService.listFeed(query, user?.userId ?? null);
  }

  @Get('works/trending')
  @ApiOkResponse({ description: 'List works with recent Community activity.' })
  listTrendingWorks() {
    return this.communityService.listTrendingWorks();
  }

  @Get('posts/:id')
  @ApiOkResponse({ description: 'Return one visible board post.' })
  async getPost(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.communityService.getPost(id, user?.userId ?? null);
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
    return this.communityService.createPost(user.userId, input);
  }

  @Get('works/:catalogTitleId/reviews')
  @ApiOkResponse({ description: 'List public reviews for one catalog title.' })
  async listReviewsByWork(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Param('catalogTitleId', new ParseUUIDPipe()) catalogTitleId: string,
    @Query() query: CommunityPostsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.communityService.listReviewsByWork(
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
    return this.communityService.getReview(id, user?.userId ?? null);
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
    return this.communityService.upsertReview(user.userId, catalogTitleId, input);
  }

  @Delete('reviews/:catalogTitleId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('catalogTitleId', new ParseUUIDPipe()) catalogTitleId: string,
  ) {
    return this.communityService.deleteReview(user.userId, catalogTitleId);
  }

  @Get('comments')
  async listComments(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityCommentsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.communityService.listComments(
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
    return this.communityService.createComment(user.userId, input);
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
    return this.communityService.updateComment(user.userId, id, input);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.communityService.deleteComment(user.userId, id);
  }

  @Put('reactions/:targetType/:targetId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addTargetReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType') targetType: string,
    @Param('targetId', new ParseUUIDPipe()) targetId: string,
  ) {
    return this.communityService.setTargetReaction(
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
    return this.communityService.setTargetReaction(
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
    return this.communityService.getProfile(handle, user?.userId ?? null);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpdateCommunityProfileDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateCommunityProfileDto,
  ) {
    return this.communityService.updateProfile(user.userId, input);
  }

  @Put('profiles/:handle/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  followProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('handle') handle: string,
  ) {
    return this.communityService.setFollow(user.userId, handle, true);
  }

  @Delete('profiles/:handle/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unfollowProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('handle') handle: string,
  ) {
    return this.communityService.setFollow(user.userId, handle, false);
  }

  @Get('taste/candidates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listTasteCandidates(@CurrentUser() user: AuthenticatedUser) {
    return this.communityService.listTasteCandidates(user.userId);
  }

  @Get('notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.communityService.listNotifications(user.userId);
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  markNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.communityService.markNotificationsRead(user.userId);
  }

  @Delete('posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Soft-delete the current author post.' })
  deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.communityService.deletePost(user.userId, id);
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
    return this.communityService.addReaction(user.userId, id);
  }

  @Delete('posts/:id/reactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Remove the current user reaction.' })
  removeReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.communityService.removeReaction(user.userId, id);
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
    return this.communityService.reportPost(user.userId, id, input);
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
    return this.communityService.reportReview(user.userId, id, input);
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
    return this.communityService.reportComment(user.userId, id, input);
  }

  @Get('moderation/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'List pending Community reports.' })
  listReports(@CurrentUser() user: AuthenticatedUser) {
    return this.communityService.listReports(user);
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
    return this.communityService.hidePost(user, id, input.note);
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
    return this.communityService.restorePost(user, id, input.note);
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
    return this.communityService.hideReview(user, id, input.note);
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
    return this.communityService.restoreReview(user, id, input.note);
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
    return this.communityService.hideComment(user, id, input.note);
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
    return this.communityService.restoreComment(user, id, input.note);
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
    return this.communityService.resolveReport(user, id, input);
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
