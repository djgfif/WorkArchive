import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TierBoardAssetKind,
  TierBoardAssetStorageType,
  TierBoardItemSourceType,
  TierBoardLayout,
  TierBoardVisibility,
} from '@prisma/client';

import {
  WORK_SYNC_STATUS_VALUES,
  type WorkSyncStatusValue,
} from '../../works/works.constants';
import { Trim } from '../../works/dto/transformers';

export class SyncTierBoardPayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ enum: TierBoardLayout })
  @IsEnum(TierBoardLayout)
  layout!: TierBoardLayout;

  @ApiProperty({ enum: TierBoardVisibility })
  @IsEnum(TierBoardVisibility)
  visibility!: TierBoardVisibility;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;

  @ApiProperty({ enum: WORK_SYNC_STATUS_VALUES })
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty()
  @IsInt()
  @Min(0)
  serverVersion!: number;
}

export class SyncTierBoardLanePayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  boardId!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(80)
  label!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(40)
  color!: string;

  @ApiProperty()
  @IsInt()
  orderIndex!: number;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;

  @ApiProperty({ enum: WORK_SYNC_STATUS_VALUES })
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty()
  @IsInt()
  @Min(0)
  serverVersion!: number;
}

export class SyncTierBoardItemPayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  boardId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  laneId!: string | null;

  @ApiProperty({ enum: TierBoardItemSourceType })
  @IsEnum(TierBoardItemSourceType)
  sourceType!: TierBoardItemSourceType;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(500)
  subtitle!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(2048)
  imageUrl!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(4000)
  note!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  linkedWorkId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  linkedCatalogTitleId!: string | null;

  @ApiProperty()
  @IsInt()
  orderIndex!: number;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;

  @ApiProperty({ enum: WORK_SYNC_STATUS_VALUES })
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty()
  @IsInt()
  @Min(0)
  serverVersion!: number;
}

export class SyncTierBoardAssetPayloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  boardId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  itemId!: string | null;

  @ApiProperty({ enum: TierBoardAssetKind })
  @IsEnum(TierBoardAssetKind)
  kind!: TierBoardAssetKind;

  @ApiProperty({ enum: TierBoardAssetStorageType })
  @IsEnum(TierBoardAssetStorageType)
  storageType!: TierBoardAssetStorageType;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(4096)
  objectUrl!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(255)
  originalName!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sizeBytes!: number;

  @ApiProperty()
  @IsDateString()
  createdAt!: string;

  @ApiProperty()
  @IsDateString()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  deletedAt!: string | null;
}
