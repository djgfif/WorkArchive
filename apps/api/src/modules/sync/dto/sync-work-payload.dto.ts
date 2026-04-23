import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus, WorkTier, WorkType } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';
import { NormalizeStringArray, Trim } from '../../works/dto/transformers';

export class SyncWorkPayloadDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  catalogTitleId?: string | null;

  @ApiProperty({
    enum: WorkType,
  })
  @IsEnum(WorkType)
  type!: WorkType;

  @ApiProperty({
    maxLength: 200,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    maxLength: 120,
  })
  @Trim()
  @IsString()
  @MaxLength(120)
  author!: string;

  @ApiProperty({
    type: [String],
  })
  @NormalizeStringArray()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  genres!: string[];

  @ApiProperty({
    maxLength: 4000,
  })
  @Trim()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiProperty({
    maxLength: 2048,
  })
  @Trim()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl!: string;

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

  @ApiPropertyOptional({
    enum: WorkTier,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(WorkTier)
  tier!: WorkTier | null;

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
