import { ApiProperty } from '@nestjs/swagger';
import {
  PULL_SYNC_OPERATIONS,
  SYNC_ENTITY_TYPES,
  SYNC_SCHEMA_VERSION,
  type PullSyncOperation,
  type SyncEntityType,
} from '../sync.constants';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';
import { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';

export class PullSyncChangeDto {
  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  entityType!: SyncEntityType;

  @ApiProperty({
    format: 'uuid',
  })
  entityId!: string;

  @ApiProperty({
    enum: PULL_SYNC_OPERATIONS,
  })
  operation!: PullSyncOperation;

  @ApiProperty({
    type: () => WorkResponseDto,
    required: false,
  })
  work?: WorkResponseDto;

  @ApiProperty({
    type: () => UserReleaseRecordResponseDto,
    required: false,
  })
  releaseRecord?: UserReleaseRecordResponseDto;

  @ApiProperty({
    type: () => SyncTimelineEntryPayloadDto,
    required: false,
  })
  timelineEntry?: SyncTimelineEntryPayloadDto;
}

export class PullSyncResponseDto {
  @ApiProperty({
    enum: [SYNC_SCHEMA_VERSION],
  })
  schemaVersion!: typeof SYNC_SCHEMA_VERSION;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  pulledAt!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  nextSince!: string;

  @ApiProperty({
    nullable: true,
    required: false,
  })
  nextCursor?: string | null;

  @ApiProperty({
    required: false,
  })
  hasMore?: boolean;

  @ApiProperty({
    type: [PullSyncChangeDto],
  })
  changes!: PullSyncChangeDto[];
}
