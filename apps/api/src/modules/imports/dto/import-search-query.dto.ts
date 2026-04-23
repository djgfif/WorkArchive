import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

import {
  ALADIN_PROVIDER,
  IMPORT_PROVIDER_VALUES,
  type ImportProvider,
} from '../imports.constants';

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export class ImportSearchQueryDto {
  @ApiPropertyOptional({
    enum: IMPORT_PROVIDER_VALUES,
    default: ALADIN_PROVIDER,
  })
  @IsOptional()
  @IsIn(IMPORT_PROVIDER_VALUES)
  provider?: ImportProvider;

  @ApiPropertyOptional({
    example: 'Dune',
    maxLength: 200,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query!: string;

  @ApiPropertyOptional({
    enum: WorkType,
    default: WorkType.novel,
  })
  @IsOptional()
  @IsEnum(WorkType)
  type?: WorkType;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
