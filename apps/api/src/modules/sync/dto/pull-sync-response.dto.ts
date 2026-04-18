import { ApiProperty } from '@nestjs/swagger';

import { WorkResponseDto } from '../../works/dto/work-response.dto';

const PULL_SYNC_OPERATIONS = ['upsert', 'delete'] as const;

export class PullSyncChangeDto {
  @ApiProperty({
    enum: ['work'],
  })
  entityType!: 'work';

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
  })
  work!: WorkResponseDto;
}

export class PullSyncResponseDto {
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
