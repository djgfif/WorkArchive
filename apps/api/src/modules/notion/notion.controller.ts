import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplyNotionPullDto, UpsertNotionConnectionDto } from './dto/notion.dto';
import { NotionService } from './notion.service';

@ApiTags('notion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notion')
export class NotionController {
  constructor(
    @Inject(NotionService) private readonly notionService: NotionService,
  ) {}

  @Get('status')
  @ApiOkResponse({
    description: 'Return Notion connection and mapping status.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.notionService.getStatus(user.userId);
  }

  @Put('connection')
  @ApiBody({
    type: UpsertNotionConnectionDto,
  })
  @ApiOkResponse({
    description: 'Store or replace the current user Notion connection.',
  })
  saveConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpsertNotionConnectionDto,
  ) {
    return this.notionService.saveConnection(user.userId, input);
  }

  @Delete('connection')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Remove the current user Notion connection and mappings.',
  })
  async deleteConnection(@CurrentUser() user: AuthenticatedUser) {
    await this.notionService.deleteConnection(user.userId);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Test the stored Notion connection.',
  })
  testConnection(@CurrentUser() user: AuthenticatedUser) {
    return this.notionService.testConnection(user.userId);
  }

  @Post('sync/push')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Push active Work Archive records to Notion.',
  })
  pushToNotion(@CurrentUser() user: AuthenticatedUser) {
    return this.notionService.pushToNotion(user.userId);
  }

  @Post('sync/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Preview safe Notion changes before applying them locally.',
  })
  previewPull(@CurrentUser() user: AuthenticatedUser) {
    return this.notionService.previewPull(user.userId);
  }

  @Post('sync/apply')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: ApplyNotionPullDto,
  })
  @ApiOkResponse({
    description: 'Apply previewed safe Notion changes to Work Archive records.',
  })
  applyPull(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ApplyNotionPullDto,
  ) {
    return this.notionService.applyPull(user.userId, input);
  }
}
