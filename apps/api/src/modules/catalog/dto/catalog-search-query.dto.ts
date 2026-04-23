import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export class CatalogSearchQueryDto {
  @ApiPropertyOptional({
    example: 'KonoSuba',
    maxLength: 200,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query!: string;

  @ApiPropertyOptional({
    enum: WorkType,
  })
  @IsOptional()
  @IsEnum(WorkType)
  mediumType?: WorkType;
}
