import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';

const PUSH_SYNC_RESULT_STATUSES = ['applied', 'conflict', 'failed'] as const;
const SYNC_RESULT_CODES = [
  'already_applied',
  'applied_change',
  'applied_tombstone',
  'created',
  'missing_remote_delete_noop',
  'conflict_remote_newer',
  'conflict_remote_missing',
  'conflict_ownership_mismatch',
  'conflict_parent_changed',
  'failed_validation',
  'failed_missing_catalog_title',
  'failed_import_draft_unresolved',
  'pull_conflict_local_queue',
  'result_missing',
  'unknown',
] as const;

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
    enum: ['work', 'release_record'],
  })
  entityType!: 'work' | 'release_record';

  @ApiProperty({
    enum: PUSH_SYNC_RESULT_STATUSES,
  })
  status!: (typeof PUSH_SYNC_RESULT_STATUSES)[number];

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    enum: SYNC_RESULT_CODES,
  })
  code?: (typeof SYNC_RESULT_CODES)[number];

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
}

export class PushSyncResponseDto {
  @ApiProperty({
    enum: [1],
  })
  schemaVersion!: 1;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  processedAt!: string;

  @ApiProperty({
    type: [PushSyncResultDto],
  })
  results!: PushSyncResultDto[];
}
