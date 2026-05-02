import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWorkDto } from './dto/create-work.dto';
import type { GroupedWorksQueryDto } from './dto/grouped-works-query.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorkResponseDto } from './dto/work-response.dto';
import { WorksService } from './works.service';

@ApiTags('works')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('works')
export class WorksController {
  constructor(@Inject(WorksService) private readonly worksService: WorksService) {}

  @Get()
  @ApiOkResponse({
    description: 'List all active works.',
    type: WorkResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.worksService.findAll(user.userId);
  }

  @Get('grouped')
  @ApiOkResponse({
    description: 'List active works grouped by franchise, medium, contributor, or status.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  findGrouped(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GroupedWorksQueryDto,
  ) {
    return this.worksService.findGrouped(user.userId, query.by);
  }

  @Get(':id')
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
    return this.worksService.findOne(user.userId, id);
  }

  @Post()
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
  ) {
    return this.worksService.create(user.userId, createWorkDto);
  }

  @Patch(':id')
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
  ) {
    return this.worksService.update(user.userId, id, updateWorkDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  ) {
    await this.worksService.remove(user.userId, id);
  }
}
