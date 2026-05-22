import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';
import { Trim } from '../../works/dto/transformers';

export class SyncReleaseRecordPayloadDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  userWorkRecordId!: string;

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  catalogReleaseId!: string;

  @ApiProperty({
    enum: WorkStatus,
  })
  @IsEnum(WorkStatus)
  status!: WorkStatus;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'rating must be a valid number' },
  )
  @Min(0)
  @Max(5)
  rating!: number | null;

  @ApiProperty({
    maxLength: 500,
  })
  @Trim()
  @IsString()
  @MaxLength(500)
  shortReview!: string;

  @ApiProperty({
    maxLength: 10000,
  })
  @Trim()
  @IsString()
  @MaxLength(10000)
  review!: string;

  @ApiProperty()
  @IsBoolean()
  favorite!: boolean;

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
