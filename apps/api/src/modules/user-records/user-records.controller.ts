import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GroupedWorksQueryDto } from '../works/dto/grouped-works-query.dto';
import type {
  CreateUserRecordDto,
  CreateUserRecordFromImportDto,
  UpdateUserRecordDto,
  UpdateProgressDto,
} from './dto/user-record.dto';
import type { UpsertUserReleaseRecordDto } from './dto/user-release-record.dto';
import { UserRecordsService } from './user-records.service';

@ApiTags('user-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-records')
export class UserRecordsController {
  constructor(
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'List active user records with normalized catalog metadata.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.userRecordsService.listViews(user.userId);
  }

  @Get('grouped')
  @ApiOkResponse({
    description: 'List active user records grouped by catalog metadata.',
  })
  async findGrouped(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GroupedWorksQueryDto,
  ) {
    return this.userRecordsService.listGroupedViews(user.userId, query.by);
  }

  @Get(':id/releases')
  @ApiOkResponse({
    description:
      'Return catalog releases for a title and optional volume-level user records.',
  })
  async findReleases(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.userRecordsService.getReleasesView(user.userId, id);
  }

  @Put(':id/progress')
  @ApiOkResponse({
    description: 'Update title-level progress fields only.',
  })
  async updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateProgressDto,
  ) {
    return this.userRecordsService.updateProgressForUser(user.userId, id, input);
  }

  @Post(':id/releases/:catalogReleaseId')
  @ApiCreatedResponse({
    description: 'Create or restore an optional volume-level user release record.',
  })
  async upsertReleaseRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('catalogReleaseId', new ParseUUIDPipe()) catalogReleaseId: string,
    @Body() input: UpsertUserReleaseRecordDto,
  ) {
    return this.userRecordsService.upsertReleaseRecordForUser(
      user.userId,
      id,
      catalogReleaseId,
      input,
    );
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Return one active user record with normalized catalog metadata.',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.userRecordsService.getViewOrThrow(user.userId, id);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Create a user record against an existing or draft catalog title.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUserRecordDto,
  ) {
    return this.userRecordsService.createViewForUser(user.userId, input);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Update only personal record fields.',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateUserRecordDto,
  ) {
    return this.userRecordsService.updateViewForUser(user.userId, id, input);
  }

  @Post('from-import')
  @ApiCreatedResponse({
    description: 'Resolve a normalized import candidate into a catalog title and user record.',
  })
  async createFromImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUserRecordFromImportDto,
  ) {
    return this.userRecordsService.createViewFromImportForUser(
      user.userId,
      input,
    );
  }
}
