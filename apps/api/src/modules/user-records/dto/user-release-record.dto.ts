import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';

import { WORK_SYNC_STATUS_VALUES, type WorkSyncStatusValue } from '../../works/works.constants';
import { Trim } from '../../works/dto/transformers';

export class UpsertUserReleaseRecordDto {
  @ApiPropertyOptional({
    enum: WorkStatus,
  })
  @IsOptional()
  @IsEnum(WorkStatus)
  status?: WorkStatus;

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
  rating?: number | null;

  @ApiPropertyOptional({
    maxLength: 500,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortReview?: string;

  @ApiPropertyOptional({
    maxLength: 10000,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  review?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class UserReleaseRecordResponseDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  userWorkRecordId!: string;

  @ApiProperty({
    format: 'uuid',
  })
  catalogReleaseId!: string;

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

  @ApiProperty()
  favorite!: boolean;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    nullable: true,
  })
  deletedAt!: string | null;

  @ApiProperty({
    enum: WORK_SYNC_STATUS_VALUES,
  })
  syncStatus!: WorkSyncStatusValue;

  @ApiProperty()
  serverVersion!: number;
}

export class CatalogReleaseWithUserRecordDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  releaseType!: string;

  @ApiProperty()
  displayLabel!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    nullable: true,
  })
  sequence!: number | null;

  @ApiProperty({
    nullable: true,
  })
  isbn!: string | null;

  @ApiProperty({
    nullable: true,
  })
  releaseDate!: string | null;

  @ApiProperty()
  summary!: string;

  @ApiProperty()
  thumbnailUrl!: string;

  @ApiProperty({
    type: () => UserReleaseRecordResponseDto,
    nullable: true,
  })
  userReleaseRecord!: UserReleaseRecordResponseDto | null;
}
