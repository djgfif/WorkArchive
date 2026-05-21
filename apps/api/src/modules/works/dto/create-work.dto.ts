import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus, WorkType } from '@prisma/client';

import { NormalizeStringArray, Trim } from './transformers';

export class CreateWorkDto {
  @ApiPropertyOptional({
    enum: WorkType,
    default: WorkType.novel,
  })
  @IsOptional()
  @IsEnum(WorkType)
  type?: WorkType;

  @ApiProperty({
    example: 'Sousou no Frieren',
    maxLength: 200,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 'Kanehito Yamada',
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Fantasy', 'Adventure'],
  })
  @NormalizeStringArray()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  genres?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['다시 볼 것', '여운 강함'],
  })
  @NormalizeStringArray()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  personalTags?: string[];

  @ApiPropertyOptional({
    example: 'A reflective fantasy journey after the hero party wins.',
    maxLength: 4000,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/frieren.jpg',
    maxLength: 2048,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    enum: WorkStatus,
    default: WorkStatus.planned,
  })
  @IsOptional()
  @IsEnum(WorkStatus)
  status?: WorkStatus;

  @ApiPropertyOptional({
    example: 4.5,
    minimum: 0,
    maximum: 5,
    nullable: true,
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
    example: 'Strong worldbuilding and atmosphere.',
    maxLength: 500,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortReview?: string;

  @ApiPropertyOptional({
    example: 'A longer review goes here.',
    maxLength: 10000,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  review?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({
    example: '2026-04-18T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-20T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  droppedAt?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-20T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  lastConsumedAt?: string | null;
}
