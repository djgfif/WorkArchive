import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkContributorRole } from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';

export class SyncWorkContributorPayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contributorId!: string;

  @ApiProperty({ enum: WorkContributorRole })
  @IsEnum(WorkContributorRole)
  role!: WorkContributorRole;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  displayOrder!: number;

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
