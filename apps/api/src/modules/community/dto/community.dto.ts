import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COMMUNITY_POST_SORTS,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_BOARD_CATEGORIES,
  WORK_TYPES,
  type CommunityBoardCategory,
  type CommunityFeedScope,
  type CommunityPostSort,
  type CommunityProfileVisibility,
  type CommunityReportReason,
  type CommunityReportResolution,
  type CommunityTargetType,
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

  @ApiPropertyOptional({ enum: COMMUNITY_BOARD_CATEGORIES })
  @IsOptional()
  @IsIn(COMMUNITY_BOARD_CATEGORIES)
  category?: CommunityBoardCategory;
}

export class CommunityFeedQueryDto {
  @ApiPropertyOptional({ enum: COMMUNITY_POST_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(COMMUNITY_POST_SORTS)
  sort: CommunityPostSort = 'latest';

  @ApiPropertyOptional({ description: 'Opaque feed cursor.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50, minimum: 1 })
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({ enum: ['all', 'following'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'following'])
  scope: CommunityFeedScope = 'all';
}

export class CreateCommunityPostDto {
  @ApiProperty({ maxLength: 1000 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ enum: COMMUNITY_BOARD_CATEGORIES, default: 'free' })
  @IsOptional()
  @IsIn(COMMUNITY_BOARD_CATEGORIES)
  category?: CommunityBoardCategory;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  catalogTitleId?: string;

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

export class UpsertCommunityReviewDto {
  @ApiPropertyOptional({ maxLength: 5000 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional({ maximum: 5, minimum: 0.5, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(5)
  rating?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
}

export class CommunityCommentsQueryDto {
  @ApiProperty({ enum: ['post', 'review'] })
  @IsIn(['post', 'review'])
  targetType!: Exclude<CommunityTargetType, 'comment'>;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;
}

export class CreateCommunityCommentDto extends CommunityCommentsQueryDto {
  @ApiProperty({ maxLength: 2000 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
}

export class UpdateCommunityCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
}

export class CommunityProfileSectionsDto {
  @IsBoolean()
  showBoardPosts!: boolean;

  @IsBoolean()
  showFollowers!: boolean;

  @IsBoolean()
  showRatings!: boolean;

  @IsBoolean()
  showReviews!: boolean;

  @IsBoolean()
  showTasteSummary!: boolean;
}

export class CommunityNotificationPreferencesDto {
  @IsBoolean()
  browser!: boolean;

  @IsBoolean()
  globalBadge!: boolean;

  @IsBoolean()
  inCommunity!: boolean;
}

export class UpdateCommunityProfileDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  allowFollowers!: boolean;

  @ApiProperty({ maxLength: 500 })
  @Trim()
  @IsString()
  @MaxLength(500)
  bio!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(12)
  @IsUUID(undefined, { each: true })
  favoriteCatalogTitleIds!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  favoriteGenres!: string[];

  @Type(() => CommunityNotificationPreferencesDto)
  @ValidateNested()
  notifications!: CommunityNotificationPreferencesDto;

  @Type(() => CommunityProfileSectionsDto)
  @ValidateNested()
  sections!: CommunityProfileSectionsDto;

  @ApiProperty({ enum: ['private', 'public'] })
  @IsIn(['private', 'public'])
  visibility!: CommunityProfileVisibility;
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
