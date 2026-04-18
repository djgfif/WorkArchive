import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WorkResponseDto } from '../../works/dto/work-response.dto';

const PUSH_SYNC_RESULT_STATUSES = ['applied', 'conflict', 'failed'] as const;

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
    enum: ['work'],
  })
  entityType!: 'work';

  @ApiProperty({
    enum: PUSH_SYNC_RESULT_STATUSES,
  })
  status!: (typeof PUSH_SYNC_RESULT_STATUSES)[number];

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    type: () => WorkResponseDto,
    nullable: true,
  })
  work!: WorkResponseDto | null;
}

export class PushSyncResponseDto {
  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  processedAt!: string;

  @ApiProperty({
    type: [PushSyncResultDto],
  })
  results!: PushSyncResultDto[];
}
