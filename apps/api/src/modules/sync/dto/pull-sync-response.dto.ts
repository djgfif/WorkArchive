import { ApiProperty } from '@nestjs/swagger';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';
import { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';

const PULL_SYNC_OPERATIONS = ['upsert', 'delete'] as const;

export class PullSyncChangeDto {
  @ApiProperty({
    enum: ['work', 'release_record', 'timeline_entry'],
  })
  entityType!: 'work' | 'release_record' | 'timeline_entry';

  @ApiProperty({
    format: 'uuid',
  })
  entityId!: string;

  @ApiProperty({
    enum: PULL_SYNC_OPERATIONS,
  })
  operation!: (typeof PULL_SYNC_OPERATIONS)[number];

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
    enum: [2],
  })
  schemaVersion!: 2;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  pulledAt!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  nextSince!: string;

  @ApiProperty({
    type: [PullSyncChangeDto],
  })
  changes!: PullSyncChangeDto[];
}
