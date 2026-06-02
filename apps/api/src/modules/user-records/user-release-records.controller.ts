import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  UpsertUserReleaseRecordDto,
  UserReleaseRecordResponseDto,
} from './dto/user-release-record.dto';
import {
  toUserReleaseRecordResponse,
  UserReleaseRecordsService,
} from './user-release-records.service';

@ApiTags('user-release-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-release-records')
export class UserReleaseRecordsController {
  constructor(
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
  ) {}

  @Patch(':id')
  @ApiBody({
    type: UpsertUserReleaseRecordDto,
  })
  @ApiOkResponse({
    description: 'Update a volume-level personal release record.',
    type: UserReleaseRecordResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpsertUserReleaseRecordDto,
  ) {
    const updated = await this.releaseRecordsService.updateForUser(
      id,
      user.userId,
      input,
    );

    return toUserReleaseRecordResponse(updated);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Soft-delete a volume-level personal release record.',
    type: UserReleaseRecordResponseDto,
  })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const deleted = await this.releaseRecordsService.softDeleteForUser(
      id,
      user.userId,
    );

    return toUserReleaseRecordResponse(deleted);
  }

  @Post(':id/restore')
  @ApiOkResponse({
    description: 'Restore a soft-deleted volume-level personal release record.',
    type: UserReleaseRecordResponseDto,
  })
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const restored = await this.releaseRecordsService.restoreForUser(
      id,
      user.userId,
    );

    return toUserReleaseRecordResponse(restored);
  }
}
