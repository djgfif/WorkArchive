import {
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
  Post,
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
  CommunityPostsQueryDto,
  CreateCommunityPostDto,
  CreateCommunityReportDto,
  ResolveCommunityReportDto,
} from './dto/community.dto';
import { CommunityService } from './community.service';

@ApiTags('community')
@ApiExtraModels(CommunityPostsQueryDto)
@Controller('community')
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
}
