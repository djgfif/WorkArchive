import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { PullSyncDto } from './dto/pull-sync.dto';
import { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import { PushSyncResponseDto } from './dto/push-sync-response.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
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
  push(@Body() pushSyncDto: PushSyncDto) {
    return this.syncService.push(pushSyncDto);
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
  pull(@Body() pullSyncDto: PullSyncDto) {
    return this.syncService.pull(pullSyncDto);
  }
}
