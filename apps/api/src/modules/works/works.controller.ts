import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { getRequestId } from '../../security/security-audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWorkDto } from './dto/create-work.dto';
import { GroupedWorksQueryDto } from './dto/grouped-works-query.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorkResponseDto } from './dto/work-response.dto';
import { WorksService } from './works.service';

@ApiTags('works')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('works')
export class WorksController {
  private readonly logger = new Logger(WorksController.name);

  constructor(
    @Inject(WorksService) private readonly worksService: WorksService,
  ) {}

  @Get()
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use GET /api/v2/user-records',
  })
  @ApiOkResponse({
    description: 'List all active works.',
    type: WorkResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    this.recordLegacyUse('list');
    return this.worksService.findAll(user.userId);
  }

  @Get('grouped')
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use GET /api/v2/user-records',
  })
  @ApiExtraModels(GroupedWorksQueryDto)
  @ApiOkResponse({
    description:
      'List active works grouped by franchise, medium, contributor, or status.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  findGrouped(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GroupedWorksQueryDto,
  ) {
    this.recordLegacyUse('list-grouped');
    return this.worksService.findGrouped(user.userId, query.by);
  }

  @Get(':id')
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use GET /api/v2/user-records/{id}',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Return a single active work.',
    type: WorkResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.recordLegacyUse('get');
    return this.worksService.findOne(user.userId, id);
  }

  @Post()
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use POST /api/v2/user-records',
  })
  @ApiBody({
    type: CreateWorkDto,
  })
  @ApiCreatedResponse({
    description: 'Create a new work.',
    type: WorkResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createWorkDto: CreateWorkDto,
    @Req() request: Request,
  ) {
    this.recordLegacyUse('create');
    return this.worksService.create(
      user.userId,
      createWorkDto,
      getRequestId(request) ?? undefined,
    );
  }

  @Patch(':id')
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use PATCH /api/v2/user-records/{id}',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiBody({
    type: UpdateWorkDto,
  })
  @ApiOkResponse({
    description: 'Update an existing active work.',
    type: WorkResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateWorkDto: UpdateWorkDto,
    @Req() request: Request,
  ) {
    this.recordLegacyUse('update');
    return this.worksService.update(
      user.userId,
      id,
      updateWorkDto,
      getRequestId(request) ?? undefined,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated: use the user-record deletion contract',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiNoContentResponse({
    description: 'Soft-delete a work.',
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    this.recordLegacyUse('delete');
    await this.worksService.remove(
      user.userId,
      id,
      getRequestId(request) ?? undefined,
    );
  }

  private recordLegacyUse(action: string) {
    this.logger.log(
      JSON.stringify({
        action,
        event: 'api.legacy_works.used',
        replacement: '/api/v2/user-records',
      }),
    );
  }
}
