import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressUnit, WorkStatus, WorkTier, WorkType } from '@prisma/client';

import { NormalizeStringArray, Trim } from '../../works/dto/transformers';

export class CreateUserRecordDto {
  @ApiPropertyOptional({
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  catalogTitleId?: string;

  @ApiPropertyOptional({
    enum: WorkType,
  })
  @IsOptional()
  @IsEnum(WorkType)
  type?: WorkType;

  @ApiPropertyOptional({
    maxLength: 200,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @ApiPropertyOptional({
    type: [String],
  })
  @NormalizeStringArray()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  genres?: string[];

  @ApiPropertyOptional({
    maxLength: 4000,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({
    maxLength: 2048,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

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

  @ApiPropertyOptional({
    enum: WorkTier,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(WorkTier)
  tier?: WorkTier | null;

  @ApiPropertyOptional({
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class UpdateUserRecordDto {
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

  @ApiPropertyOptional({
    enum: WorkTier,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(WorkTier)
  tier?: WorkTier | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class UpdateProgressDto {
  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  progressCurrent?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  progressTotal?: number | null;

  @ApiPropertyOptional({
    enum: ProgressUnit,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ProgressUnit)
  progressUnit?: ProgressUnit | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastConsumedLabel?: string | null;
}

export class ImportContributorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class ImportExternalRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;
}

export class ImportReleaseCandidateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayLabel?: string;

  @ApiPropertyOptional({
    type: [ImportExternalRefDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportExternalRefDto)
  externalRefs?: ImportExternalRefDto[];

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsString()
  isbn?: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsString()
  releaseDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  releaseType?: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  sequence?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateUserRecordFromImportDto extends CreateUserRecordDto {
  @ApiProperty({
    enum: WorkType,
  })
  @IsEnum(WorkType)
  mediumType!: WorkType;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  catalogTitle!: string;

  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  franchiseName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  releaseYear?: number | null;

  @ApiPropertyOptional({
    type: [ImportContributorDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportContributorDto)
  contributors?: ImportContributorDto[];

  @ApiPropertyOptional({
    type: [ImportExternalRefDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportExternalRefDto)
  externalRefs?: ImportExternalRefDto[];

  @ApiPropertyOptional({
    type: [ImportReleaseCandidateDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportReleaseCandidateDto)
  releaseCandidates?: ImportReleaseCandidateDto[];
}
