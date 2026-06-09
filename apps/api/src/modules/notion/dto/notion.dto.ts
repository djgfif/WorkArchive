import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Trim } from '../../works/dto/transformers';

export class UpsertNotionConnectionDto {
  @ApiProperty({
    description: 'Notion internal integration token or OAuth access token.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;

  @ApiProperty({
    description: 'Notion data source ID for the archive mirror.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  dataSourceId!: string;
}

export class ApplyNotionPullDto {
  @ApiPropertyOptional({
    description:
      'Optional subset of user work record IDs to apply. When omitted, all previewed safe field changes are applied.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  workIds?: string[];
}
