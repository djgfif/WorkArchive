import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  Query,
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
import { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import { ImportSearchQueryDto } from './dto/import-search-query.dto';
import { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { UpsertAladinKeyDto } from './dto/upsert-aladin-key.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('imports')
export class ImportsController {
  constructor(
    @Inject(ImportsService) private readonly importsService: ImportsService,
  ) {}

  @Get('providers/aladin/status')
  @ApiOkResponse({
    description: 'Return whether the current user has configured Aladin search.',
    type: ImportProviderStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  getAladinStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.importsService.getAladinProviderStatus(user.userId);
  }

  @Put('providers/aladin/key')
  @ApiBody({
    type: UpsertAladinKeyDto,
  })
  @ApiOkResponse({
    description: 'Store or replace the current user Aladin TTBKey.',
    type: ImportProviderStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  saveAladinKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() upsertAladinKeyDto: UpsertAladinKeyDto,
  ) {
    return this.importsService.saveAladinKey(
      user.userId,
      upsertAladinKeyDto.ttbKey,
    );
  }

  @Delete('providers/aladin/key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Remove the current user Aladin TTBKey.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async deleteAladinKey(@CurrentUser() user: AuthenticatedUser) {
    await this.importsService.deleteAladinKey(user.userId);
  }

  @Get('search')
  @ApiOkResponse({
    description: 'Search provider metadata candidates for Quick Add.',
    type: ImportSearchResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() importSearchQueryDto: ImportSearchQueryDto,
  ) {
    return this.importsService.search(user.userId, importSearchQueryDto);
  }
}
