import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogSubmissionStatus } from '@prisma/client';

export class CatalogSubmissionsQueryDto {
  @ApiPropertyOptional({
    enum: CatalogSubmissionStatus,
  })
  @IsOptional()
  @IsEnum(CatalogSubmissionStatus)
  status?: CatalogSubmissionStatus;
}
