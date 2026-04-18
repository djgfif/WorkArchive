import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PullSyncDto {
  @ApiPropertyOptional({
    example: '2026-04-18T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  since?: string | null;
}
