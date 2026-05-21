import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { getRequestId } from '../../security/security-audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PullSyncDto } from './dto/pull-sync.dto';
import { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import { PushSyncResponseDto } from './dto/push-sync-response.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post('push')
  @ApiBody({
    type: PushSyncDto,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Push queued local changes to the remote store.',
    type: PushSyncResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() pushSyncDto: PushSyncDto,
    @Req() request: Request,
  ) {
    return this.syncService.push(
      user.userId,
      pushSyncDto,
      getRequestId(request) ?? undefined,
    );
  }

  @Post('pull')
  @ApiBody({
    type: PullSyncDto,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Pull remote changes since the last successful sync cursor.',
    type: PullSyncResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  pull(
    @CurrentUser() user: AuthenticatedUser,
    @Body() pullSyncDto: PullSyncDto,
    @Req() request: Request,
  ) {
    return this.syncService.pull(
      user.userId,
      pullSyncDto,
      getRequestId(request) ?? undefined,
    );
  }
}
