import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PUSH_RESULT_STATUSES,
  SYNC_ENTITY_TYPES,
  SYNC_RESULT_CODES,
  SYNC_SCHEMA_VERSION,
  type PushResultStatus,
  type SyncEntityType,
  type SyncResultCode,
} from '../sync.constants';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';
import { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';

export class PushSyncResultDto {
  @ApiProperty({
    format: 'uuid',
  })
  queueId!: string;

  @ApiProperty({
    format: 'uuid',
  })
  entityId!: string;

  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  entityType!: SyncEntityType;

  @ApiProperty({
    enum: PUSH_RESULT_STATUSES,
  })
  status!: PushResultStatus;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    enum: SYNC_RESULT_CODES,
  })
  code?: SyncResultCode;

  @ApiPropertyOptional({
    type: () => WorkResponseDto,
    nullable: true,
  })
  work?: WorkResponseDto | null;

  @ApiPropertyOptional({
    type: () => UserReleaseRecordResponseDto,
    nullable: true,
  })
  releaseRecord?: UserReleaseRecordResponseDto | null;

  @ApiPropertyOptional({
    type: () => SyncTimelineEntryPayloadDto,
    nullable: true,
  })
  timelineEntry?: SyncTimelineEntryPayloadDto | null;
}

export class PushSyncResponseDto {
  @ApiProperty({
    enum: [SYNC_SCHEMA_VERSION],
  })
  schemaVersion!: typeof SYNC_SCHEMA_VERSION;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  processedAt!: string;

  @ApiProperty({
    type: [PushSyncResultDto],
  })
  results!: PushSyncResultDto[];
}
