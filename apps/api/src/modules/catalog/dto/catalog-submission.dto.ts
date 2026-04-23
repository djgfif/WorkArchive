import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CATALOG_SUBMISSION_ENTITY_TYPES = [
  'franchise',
  'catalogTitle',
  'catalogRelease',
  'contributor',
  'catalogRelation',
] as const;

const CATALOG_SUBMISSION_ACTIONS = ['create', 'update', 'merge', 'delete'] as const;

export class CreateCatalogSubmissionDto {
  @ApiProperty({
    enum: CATALOG_SUBMISSION_ENTITY_TYPES,
  })
  @IsIn(CATALOG_SUBMISSION_ENTITY_TYPES)
  entityType!: (typeof CATALOG_SUBMISSION_ENTITY_TYPES)[number];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  entityId?: string | null;

  @ApiProperty({
    enum: CATALOG_SUBMISSION_ACTIONS,
  })
  @IsIn(CATALOG_SUBMISSION_ACTIONS)
  action!: (typeof CATALOG_SUBMISSION_ACTIONS)[number];

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ReviewCatalogSubmissionDto {
  @ApiPropertyOptional({
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}

export class MergeCatalogTitleDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  targetTitleId!: string;
}
