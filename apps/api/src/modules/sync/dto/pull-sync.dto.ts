import {
  Equals,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SYNC_SCHEMA_VERSION } from '../sync.constants';

export class PullSyncDto {
  @ApiPropertyOptional({
    description:
      'Stable local client identifier used by clients for sync coordination telemetry.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({
    default: SYNC_SCHEMA_VERSION,
    description: 'Sync contract version. Missing values are treated as v2.',
    enum: [SYNC_SCHEMA_VERSION],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Equals(SYNC_SCHEMA_VERSION)
  schemaVersion?: typeof SYNC_SCHEMA_VERSION;

  @ApiPropertyOptional({
    example: '2026-04-18T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  since?: string | null;

  @ApiPropertyOptional({
    description:
      'Opaque pagination cursor returned as nextCursor. Use with limit to continue a large pull without skipping same-timestamp changes.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cursor?: string | null;

  @ApiPropertyOptional({
    default: 500,
    description:
      'Maximum number of changes to return. Missing values use the server default page size.',
    maximum: 1000,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
