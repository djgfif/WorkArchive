import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COMMUNITY_POST_SORTS,
  COMMUNITY_REPORT_REASONS,
  WORK_TYPES,
  type CommunityPostSort,
  type CommunityReportReason,
  type CommunityReportResolution,
  type WorkType,
} from '@work-archive/shared-types';

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

function OptionalTrim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );
}

export class CommunityPostsQueryDto {
  @ApiPropertyOptional({ enum: COMMUNITY_POST_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(COMMUNITY_POST_SORTS)
  sort: CommunityPostSort = 'latest';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50, minimum: 1 })
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class CreateCommunityPostDto {
  @ApiProperty({ maxLength: 1000 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;

  @ApiPropertyOptional({ maxLength: 200 })
  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workTitle?: string;

  @ApiPropertyOptional({ enum: WORK_TYPES })
  @IsOptional()
  @IsIn(WORK_TYPES)
  workType?: WorkType;

  @ApiPropertyOptional({ maxLength: 2000 })
  @OptionalTrim()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  workThumbnailUrl?: string;
}

export class CreateCommunityReportDto {
  @ApiProperty({ enum: COMMUNITY_REPORT_REASONS })
  @IsIn(COMMUNITY_REPORT_REASONS)
  reason!: CommunityReportReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}

export class CommunityModerationActionDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalTrim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ResolveCommunityReportDto extends CommunityModerationActionDto {
  @ApiProperty({ enum: ['resolve', 'dismiss'] })
  @IsIn(['resolve', 'dismiss'])
  resolution!: CommunityReportResolution;
}
