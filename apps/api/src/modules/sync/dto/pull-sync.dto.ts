import {
  Equals,
  IsDateString,
  IsInt,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PullSyncDto {
  @ApiPropertyOptional({
    default: 2,
    description: 'Sync contract version. Missing values are treated as v2.',
    enum: [2],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Equals(2)
  schemaVersion?: 2;

  @ApiPropertyOptional({
    example: '2026-04-18T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  since?: string | null;
}
