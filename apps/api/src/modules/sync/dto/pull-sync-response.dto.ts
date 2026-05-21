import { ApiProperty } from '@nestjs/swagger';
import {
  PULL_SYNC_OPERATIONS,
  SYNC_ENTITY_TYPES,
  SYNC_SCHEMA_VERSION,
  type PullSyncOperation,
  type SyncEntityType,
} from '../sync.constants';

import { UserReleaseRecordResponseDto } from '../../user-records/dto/user-release-record.dto';
import { WorkResponseDto } from '../../works/dto/work-response.dto';
import { SyncContributorPayloadDto } from './sync-contributor-payload.dto';
import { SyncSeriesPayloadDto } from './sync-series-payload.dto';
import { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';
import {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardItemPayloadDto,
  SyncTierBoardLanePayloadDto,
  SyncTierBoardPayloadDto,
} from './sync-tier-board-payload.dto';
import { SyncWorkContributorPayloadDto } from './sync-work-contributor-payload.dto';
import { SyncWorkRelationPayloadDto } from './sync-work-relation-payload.dto';
import { SyncWorkSeriesLinkPayloadDto } from './sync-work-series-link-payload.dto';

export class PullSyncChangeDto {
  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  entityType!: SyncEntityType;

  @ApiProperty({
    format: 'uuid',
  })
  entityId!: string;

  @ApiProperty({
    enum: PULL_SYNC_OPERATIONS,
  })
  operation!: PullSyncOperation;

  @ApiProperty({
    type: () => WorkResponseDto,
    required: false,
  })
  work?: WorkResponseDto;

  @ApiProperty({
    type: () => UserReleaseRecordResponseDto,
    required: false,
  })
  releaseRecord?: UserReleaseRecordResponseDto;

  @ApiProperty({
    type: () => SyncTimelineEntryPayloadDto,
    required: false,
  })
  timelineEntry?: SyncTimelineEntryPayloadDto;

  @ApiProperty({
    type: () => SyncSeriesPayloadDto,
    required: false,
  })
  series?: SyncSeriesPayloadDto;

  @ApiProperty({
    type: () => SyncWorkSeriesLinkPayloadDto,
    required: false,
  })
  workSeriesLink?: SyncWorkSeriesLinkPayloadDto;

  @ApiProperty({
    type: () => SyncContributorPayloadDto,
    required: false,
  })
  contributor?: SyncContributorPayloadDto;

  @ApiProperty({
    type: () => SyncWorkContributorPayloadDto,
    required: false,
  })
  workContributor?: SyncWorkContributorPayloadDto;

  @ApiProperty({
    type: () => SyncWorkRelationPayloadDto,
    required: false,
  })
  workRelation?: SyncWorkRelationPayloadDto;

  @ApiProperty({
    type: () => SyncTierBoardPayloadDto,
    required: false,
  })
  tierBoard?: SyncTierBoardPayloadDto;

  @ApiProperty({
    type: () => SyncTierBoardLanePayloadDto,
    required: false,
  })
  tierBoardLane?: SyncTierBoardLanePayloadDto;

  @ApiProperty({
    type: () => SyncTierBoardItemPayloadDto,
    required: false,
  })
  tierBoardItem?: SyncTierBoardItemPayloadDto;

  @ApiProperty({
    type: () => SyncTierBoardAssetPayloadDto,
    required: false,
  })
  tierBoardAsset?: SyncTierBoardAssetPayloadDto;
}

export class PullSyncResponseDto {
  @ApiProperty({
    enum: [SYNC_SCHEMA_VERSION],
  })
  schemaVersion!: typeof SYNC_SCHEMA_VERSION;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  pulledAt!: string;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  nextSince!: string;

  @ApiProperty({
    nullable: true,
    required: false,
  })
  nextCursor?: string | null;

  @ApiProperty({
    required: false,
  })
  hasMore?: boolean;

  @ApiProperty({
    type: [PullSyncChangeDto],
  })
  changes!: PullSyncChangeDto[];
}
