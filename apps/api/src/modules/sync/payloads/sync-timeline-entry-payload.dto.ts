import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimelineEntryType } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';
import { Trim } from '../../works/dto/transformers';

export class SyncTimelineEntryPayloadDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  workId!: string;

  @ApiProperty({
    enum: TimelineEntryType,
  })
  @IsEnum(TimelineEntryType)
  type!: TimelineEntryType;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({
    maxLength: 4000,
  })
  @Trim()
  @IsString()
  @MaxLength(4000)
  note!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;

  @ApiProperty({
    enum: WORK_SYNC_STATUS_VALUES,
  })
  @IsIn(WORK_SYNC_STATUS_VALUES)
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty({
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  serverVersion!: number;
}
