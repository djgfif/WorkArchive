import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { SyncWorkPayloadDto } from './sync-work-payload.dto';

const SYNC_ENTITY_TYPES = ['work'] as const;
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
  entityType!: 'work';

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
    type: () => SyncWorkPayloadDto,
  })
  @ValidateNested()
  @Type(() => SyncWorkPayloadDto)
  payload!: SyncWorkPayloadDto;
}

export class PushSyncDto {
  @ApiProperty({
    type: [PushSyncChangeDto],
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PushSyncChangeDto)
  changes!: PushSyncChangeDto[];
}
