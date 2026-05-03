import { Equals, IsDateString, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PullSyncDto {
  @ApiPropertyOptional({
    default: 1,
    description: 'Sync contract version. Missing values are treated as v1.',
    enum: [1],
  })
  @IsOptional()
  @IsInt()
  @Equals(1)
  schemaVersion?: 1;

  @ApiPropertyOptional({
    example: '2026-04-18T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  since?: string | null;
}
