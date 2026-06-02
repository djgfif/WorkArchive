import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

export const IMPORT_RESOLVE_ARRAY_MAX_SIZE = 20;
export const IMPORT_RESOLVE_TEXT_MAX_LENGTH = 4000;
export const IMPORT_RESOLVE_TITLE_MAX_LENGTH = 200;
export const IMPORT_RESOLVE_URL_MAX_LENGTH = 2048;

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

class ResolveImportExternalRefDto {
  @ApiProperty({
    maxLength: 80,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  provider!: string;

  @ApiProperty({
    maxLength: 300,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  externalId!: string;

  @ApiPropertyOptional({
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  rawType?: string | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_URL_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_URL_MAX_LENGTH)
  url?: string | null;
}

class ResolveImportContributorDto {
  @ApiProperty({
    maxLength: 120,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string | null;
}

class ResolveImportRelationHintDto {
  @ApiProperty({
    maxLength: 80,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  relationType!: string;

  @ApiProperty({
    maxLength: IMPORT_RESOLVE_TITLE_MAX_LENGTH,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(IMPORT_RESOLVE_TITLE_MAX_LENGTH)
  targetTitle!: string;
}

class ResolveImportReleaseCandidateDto {
  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayLabel?: string | null;

  @ApiPropertyOptional({
    type: [ResolveImportExternalRefDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportExternalRefDto)
  externalRefs?: ResolveImportExternalRefDto[] | null;

  @ApiPropertyOptional({
    maxLength: 32,
    nullable: true,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  isbn?: string | null;

  @ApiPropertyOptional({
    maxLength: 40,
    nullable: true,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  releaseDate?: string | null;

  @ApiPropertyOptional({
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  releaseType?: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  sequence?: number | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_URL_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_URL_MAX_LENGTH)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_TITLE_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_TITLE_MAX_LENGTH)
  title?: string | null;
}

class ResolveImportScoreBreakdownDto {
  @ApiProperty({
    maxLength: 120,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  weight!: number;
}

export class ResolveImportCandidateDto {
  @ApiPropertyOptional({
    maxLength: 300,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  id?: string | null;

  @ApiPropertyOptional({
    maxLength: 300,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  externalId?: string | null;

  @ApiPropertyOptional({
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceId?: string | null;

  @ApiPropertyOptional({
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string | null;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceLabel?: string | null;

  @ApiProperty({
    maxLength: IMPORT_RESOLVE_TITLE_MAX_LENGTH,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(IMPORT_RESOLVE_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @IsString({ each: true })
  @MaxLength(IMPORT_RESOLVE_TITLE_MAX_LENGTH, { each: true })
  titleAliases?: string[] | null;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string | null;

  @ApiPropertyOptional({
    enum: WorkType,
  })
  @IsOptional()
  @IsEnum(WorkType)
  type?: WorkType | null;

  @ApiPropertyOptional({
    enum: WorkType,
  })
  @IsOptional()
  @IsEnum(WorkType)
  mediumType?: WorkType | null;

  @ApiPropertyOptional({
    maxLength: 120,
    nullable: true,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subType?: string | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_TEXT_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_TEXT_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_URL_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_URL_MAX_LENGTH)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({
    maxLength: 1000,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  genresText?: string | null;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  formatLabel?: string | null;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  countLabel?: string | null;

  @ApiPropertyOptional({
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  confidenceLabel?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({
    maxLength: IMPORT_RESOLVE_URL_MAX_LENGTH,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_RESOLVE_URL_MAX_LENGTH)
  sourceUrl?: string | null;

  @ApiPropertyOptional({
    maxLength: 120,
    nullable: true,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  franchiseName?: string | null;

  @ApiPropertyOptional({
    maximum: 9999,
    minimum: 1000,
    nullable: true,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(9999)
  releaseYear?: number | null;

  @ApiPropertyOptional({
    maxLength: 40,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  releaseDate?: string | null;

  @ApiPropertyOptional({
    type: [ResolveImportContributorDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportContributorDto)
  contributors?: ResolveImportContributorDto[] | null;

  @ApiPropertyOptional({
    type: [ResolveImportRelationHintDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportRelationHintDto)
  relationsHint?: ResolveImportRelationHintDto[] | null;

  @ApiPropertyOptional({
    type: [ResolveImportExternalRefDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportExternalRefDto)
  externalRefs?: ResolveImportExternalRefDto[] | null;

  @ApiPropertyOptional({
    type: [ResolveImportReleaseCandidateDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportReleaseCandidateDto)
  releaseCandidates?: ResolveImportReleaseCandidateDto[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  confidence?: number | null;

  @ApiPropertyOptional({
    maxLength: 500,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @ApiPropertyOptional({
    type: [ResolveImportScoreBreakdownDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_RESOLVE_ARRAY_MAX_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ResolveImportScoreBreakdownDto)
  scoreBreakdown?: ResolveImportScoreBreakdownDto[] | null;
}
