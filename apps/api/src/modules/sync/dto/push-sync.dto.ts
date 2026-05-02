import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsObject,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import type { SyncReleaseRecordPayloadDto } from './sync-release-record-payload.dto';
import type { SyncWorkPayloadDto } from './sync-work-payload.dto';

const SYNC_ENTITY_TYPES = ['work', 'release_record'] as const;
const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;

export class PushSyncChangeDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  queueId!: string;

  @ApiProperty({
    enum: SYNC_ENTITY_TYPES,
  })
  @IsIn(SYNC_ENTITY_TYPES)
  entityType!: (typeof SYNC_ENTITY_TYPES)[number];

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  entityId!: string;

  @ApiProperty({
    enum: SYNC_OPERATIONS,
  })
  @IsIn(SYNC_OPERATIONS)
  operation!: 'create' | 'update' | 'delete';

  @ApiProperty({
    example: '2026-04-18T00:00:00.000Z',
  })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/SyncWorkPayloadDto' },
      { $ref: '#/components/schemas/SyncReleaseRecordPayloadDto' },
    ],
  })
  @IsDefined()
  @IsObject()
  payload!: SyncWorkPayloadDto | SyncReleaseRecordPayloadDto;
}

export class PushSyncDto {
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
