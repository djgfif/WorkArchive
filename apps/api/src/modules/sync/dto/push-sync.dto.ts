import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SYNC_ENTITY_TYPES,
  SYNC_OPERATIONS,
  SYNC_SCHEMA_VERSION,
  type SyncEntityType,
  type SyncOperation,
} from '../sync.constants';

import type { SyncReleaseRecordPayloadDto } from './sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from './sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from './sync-timeline-entry-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from './sync-tier-board-payload.dto';
import type { SyncContributorPayloadDto } from './sync-contributor-payload.dto';
import type { SyncWorkContributorPayloadDto } from './sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from './sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from './sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from './sync-work-series-link-payload.dto';

export class PushSyncChangeDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  queueId!: string;

  @ApiProperty({
    format: 'uuid',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  clientMutationId?: string;

  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  @IsIn(SYNC_ENTITY_TYPES)
  entityType!: SyncEntityType;

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  entityId!: string;

  @ApiProperty({
    enum: SYNC_OPERATIONS,
  })
  @IsIn(SYNC_OPERATIONS)
  operation!: SyncOperation;

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/SyncWorkPayloadDto' },
      { $ref: '#/components/schemas/SyncReleaseRecordPayloadDto' },
      { $ref: '#/components/schemas/SyncTimelineEntryPayloadDto' },
      { $ref: '#/components/schemas/SyncSeriesPayloadDto' },
      { $ref: '#/components/schemas/SyncWorkSeriesLinkPayloadDto' },
      { $ref: '#/components/schemas/SyncContributorPayloadDto' },
      { $ref: '#/components/schemas/SyncWorkContributorPayloadDto' },
      { $ref: '#/components/schemas/SyncWorkRelationPayloadDto' },
      { $ref: '#/components/schemas/SyncTierBoardPayloadDto' },
      { $ref: '#/components/schemas/SyncTierLanePayloadDto' },
      { $ref: '#/components/schemas/SyncTierBoardCardPayloadDto' },
      { $ref: '#/components/schemas/SyncTierBoardAssetPayloadDto' },
    ],
  })
  @IsDefined()
  @IsObject()
  payload!:
    | SyncWorkPayloadDto
    | SyncReleaseRecordPayloadDto
    | SyncTimelineEntryPayloadDto
    | SyncSeriesPayloadDto
    | SyncWorkSeriesLinkPayloadDto
    | SyncContributorPayloadDto
    | SyncWorkContributorPayloadDto
    | SyncWorkRelationPayloadDto
    | SyncTierBoardPayloadDto
    | SyncTierLanePayloadDto
    | SyncTierBoardCardPayloadDto
    | SyncTierBoardAssetPayloadDto;
}

export class PushSyncDto {
  @ApiPropertyOptional({
    default: SYNC_SCHEMA_VERSION,
    description: 'Sync contract version. Missing values are treated as v2.',
    enum: [SYNC_SCHEMA_VERSION],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Equals(SYNC_SCHEMA_VERSION)
  schemaVersion?: typeof SYNC_SCHEMA_VERSION;

  @ApiProperty({
    type: [PushSyncChangeDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PushSyncChangeDto)
  changes!: PushSyncChangeDto[];
}
