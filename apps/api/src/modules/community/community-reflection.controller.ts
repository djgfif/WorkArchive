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
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommunityPostSurface } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { extractOptionalBearerAccessToken } from '../auth/bearer-token';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CommunityModerationActionDto,
  CreateCommunityPostDto,
  CreateCommunityReportDto,
  ResolveCommunityReportDto,
} from './dto/community.dto';
import type { CommunityPostsQueryDto } from './dto/community.dto';
import {
  CommunityReleaseGuard,
  RequireCommunityRelease,
} from './community-release-policy';
import { CommunityInteractionService } from './services/community-interaction.service';
import { CommunityModerationService } from './services/community-moderation.service';
import { CommunityPublicationService } from './services/community-publication.service';
import { CommunityQueryService } from './services/community-query.service';

@ApiTags('community-reflections')
@Controller('community/reflections')
@RequireCommunityRelease('reflection')
@UseGuards(CommunityReleaseGuard)
export class CommunityReflectionController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CommunityInteractionService)
    private readonly interactions: CommunityInteractionService,
    @Inject(CommunityModerationService)
    private readonly moderation: CommunityModerationService,
    @Inject(CommunityPublicationService)
    private readonly publication: CommunityPublicationService,
    @Inject(CommunityQueryService)
    private readonly queries: CommunityQueryService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List visible short public reflections.' })
  async listReflections(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() query: CommunityPostsQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);
    return this.queries.listPosts(
      query,
      user?.userId ?? null,
      CommunityPostSurface.reflection,
    );
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityPostDto })
  @ApiCreatedResponse({ description: 'Publish a short public reflection.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  createReflection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCommunityPostDto,
  ) {
    return this.publication.createPost(
      user.userId,
      input,
      CommunityPostSurface.reflection,
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteReflection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.publication.deletePost(
      user.userId,
      id,
      CommunityPostSurface.reflection,
    );
  }

  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.interactions.addReaction(
      user.userId,
      id,
      CommunityPostSurface.reflection,
    );
  }

  @Delete(':id/reactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeReaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.interactions.removeReaction(
      user.userId,
      id,
      CommunityPostSurface.reflection,
    );
  }

  @Post(':id/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCommunityReportDto })
  reportReflection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateCommunityReportDto,
  ) {
    return this.moderation.reportPost(
      user.userId,
      id,
      input,
      CommunityPostSurface.reflection,
    );
  }

  @Get('moderation/reports')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listReports(@CurrentUser() user: AuthenticatedUser) {
    return this.moderation.listReports(user, 'reflection');
  }

  @Post('moderation/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  hideReflection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.hidePost(
      user,
      id,
      input.note,
      CommunityPostSurface.reflection,
    );
  }

  @Post('moderation/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CommunityModerationActionDto })
  restoreReflection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CommunityModerationActionDto,
  ) {
    return this.moderation.restorePost(
      user,
      id,
      input.note,
      CommunityPostSurface.reflection,
    );
  }

  @Post('moderation/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: ResolveCommunityReportDto })
  resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ResolveCommunityReportDto,
  ) {
    return this.moderation.resolveReport(user, id, input, 'reflection');
  }

  private async getOptionalUser(authorizationHeader?: string) {
    const accessToken = extractOptionalBearerAccessToken(authorizationHeader);
    return accessToken
      ? this.authService.validateAccessToken(accessToken)
      : null;
  }
}
