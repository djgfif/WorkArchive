import {
  ArrayMaxSize,
  IsArray,
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
import { ContributorEntityType } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';
import { NormalizeStringArray, Trim } from '../../works/dto/transformers';

export class SyncContributorPayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  @MaxLength(200)
  normalizedName!: string;

  @ApiProperty({ type: [String] })
  @NormalizeStringArray()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  aliases!: string[];

  @ApiProperty({ enum: ContributorEntityType })
  @IsEnum(ContributorEntityType)
  entityType!: ContributorEntityType;

  @ApiProperty({ example: '2026-04-18T00:00:00.000Z' })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({ example: '2026-04-18T00:00:00.000Z' })
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;

  @ApiProperty({ enum: WORK_SYNC_STATUS_VALUES })
  @IsIn(WORK_SYNC_STATUS_VALUES)
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  serverVersion!: number;
}
