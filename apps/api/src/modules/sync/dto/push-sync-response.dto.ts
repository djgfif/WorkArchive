import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PUSH_RESULT_STATUSES,
  SYNC_ENTITY_TYPES,
  SYNC_RESULT_CODES,
  SYNC_SCHEMA_VERSION,
  type PushResultStatus,
  type SyncEntityType,
  type SyncResultCode,
} from '../sync.constants';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';
import { SyncContributorPayloadDto } from './sync-contributor-payload.dto';
import { SyncSeriesPayloadDto } from './sync-series-payload.dto';
import { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';
import {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from './sync-tier-board-payload.dto';
import { SyncWorkContributorPayloadDto } from './sync-work-contributor-payload.dto';
import { SyncWorkRelationPayloadDto } from './sync-work-relation-payload.dto';
import { SyncWorkSeriesLinkPayloadDto } from './sync-work-series-link-payload.dto';

export class PushSyncResultDto {
  @ApiProperty({
    format: 'uuid',
  })
  queueId!: string;

  @ApiProperty({
    format: 'uuid',
  })
  entityId!: string;

  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  entityType!: SyncEntityType;

  @ApiProperty({
    enum: PUSH_RESULT_STATUSES,
  })
  status!: PushResultStatus;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    enum: SYNC_RESULT_CODES,
  })
  code?: SyncResultCode;

  @ApiPropertyOptional({
    type: () => WorkResponseDto,
    nullable: true,
  })
  work?: WorkResponseDto | null;

  @ApiPropertyOptional({
    type: () => UserReleaseRecordResponseDto,
    nullable: true,
  })
  releaseRecord?: UserReleaseRecordResponseDto | null;

  @ApiPropertyOptional({
    type: () => SyncTimelineEntryPayloadDto,
    nullable: true,
  })
  timelineEntry?: SyncTimelineEntryPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncSeriesPayloadDto,
    nullable: true,
  })
  series?: SyncSeriesPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncWorkSeriesLinkPayloadDto,
    nullable: true,
  })
  workSeriesLink?: SyncWorkSeriesLinkPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncContributorPayloadDto,
    nullable: true,
  })
  contributor?: SyncContributorPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncWorkContributorPayloadDto,
    nullable: true,
  })
  workContributor?: SyncWorkContributorPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncWorkRelationPayloadDto,
    nullable: true,
  })
  workRelation?: SyncWorkRelationPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncTierBoardPayloadDto,
    nullable: true,
  })
  tierBoard?: SyncTierBoardPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncTierLanePayloadDto,
    nullable: true,
  })
  tierLane?: SyncTierLanePayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncTierBoardCardPayloadDto,
    nullable: true,
  })
  tierBoardCard?: SyncTierBoardCardPayloadDto | null;

  @ApiPropertyOptional({
    type: () => SyncTierBoardAssetPayloadDto,
    nullable: true,
  })
  tierBoardAsset?: SyncTierBoardAssetPayloadDto | null;
}

export class PushSyncResponseDto {
  @ApiProperty({
    enum: [SYNC_SCHEMA_VERSION],
  })
  schemaVersion!: typeof SYNC_SCHEMA_VERSION;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  processedAt!: string;

  @ApiProperty({
    type: [PushSyncResultDto],
  })
  results!: PushSyncResultDto[];
}
