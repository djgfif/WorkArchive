import { ApiProperty } from '@nestjs/swagger';
import { ProgressUnit, WorkStatus, WorkTier, WorkType } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../works.constants';

export class WorkResponseDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  catalogTitleId!: string | null;

  @ApiProperty({
    enum: WorkType,
  })
  type!: WorkType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  author!: string;

  @ApiProperty({
    type: [String],
  })
  genres!: string[];

  @ApiProperty()
  description!: string;

  @ApiProperty()
  thumbnailUrl!: string;

  @ApiProperty({
    enum: WorkStatus,
  })
  status!: WorkStatus;

  @ApiProperty({
    nullable: true,
    minimum: 0,
    maximum: 5,
  })
  rating!: number | null;

  @ApiProperty()
  shortReview!: string;

  @ApiProperty()
  review!: string;

  @ApiProperty({
    type: [String],
  })
  personalTags!: string[];

  @ApiProperty({
    enum: WorkTier,
    nullable: true,
  })
  tier!: WorkTier | null;

  @ApiProperty()
  favorite!: boolean;

  @ApiProperty({
    nullable: true,
    minimum: 0,
  })
  progressCurrent!: number | null;

  @ApiProperty({
    nullable: true,
    minimum: 0,
  })
  progressTotal!: number | null;

  @ApiProperty({
    enum: ProgressUnit,
    nullable: true,
  })
  progressUnit!: ProgressUnit | null;

  @ApiProperty({
    nullable: true,
  })
  lastConsumedLabel!: string | null;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: null,
    nullable: true,
  })
  deletedAt!: Date | null;

  @ApiProperty({
    enum: WORK_SYNC_STATUS_VALUES,
  })
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty({
    example: 1,
  })
  serverVersion!: number;
}
