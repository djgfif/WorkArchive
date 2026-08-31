import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

import { Trim } from '../../works/dto/transformers';
import { ImportExternalRefDto, UpdateUserRecordDto } from './user-record.dto';

export const USER_RECORD_IDENTITY_KINDS_V2 = [
  'catalog',
  'external',
  'manual',
] as const;

export class UserRecordIdentityV2Dto {
  @ApiProperty({ enum: USER_RECORD_IDENTITY_KINDS_V2 })
  @IsIn(USER_RECORD_IDENTITY_KINDS_V2)
  kind!: (typeof USER_RECORD_IDENTITY_KINDS_V2)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  catalogTitleId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  externalId?: string;

  @ApiPropertyOptional({ type: [ImportExternalRefDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportExternalRefDto)
  externalRefs?: ImportExternalRefDto[];

  @ApiPropertyOptional({ maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: WorkType })
  @IsOptional()
  @IsEnum(WorkType)
  mediumType?: WorkType;

  @ApiPropertyOptional({ maxLength: 120 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;
}

export class CatalogUserRecordIdentityV2Schema {
  @ApiProperty({ enum: ['catalog'] })
  kind!: 'catalog';

  @ApiProperty({ format: 'uuid' })
  catalogTitleId!: string;
}

export class ExternalUserRecordIdentityV2Schema {
  @ApiProperty({ enum: ['external'] })
  kind!: 'external';

  @ApiProperty({ maxLength: 80 })
  provider!: string;

  @ApiProperty({ maxLength: 300 })
  externalId!: string;

  @ApiPropertyOptional({ type: [ImportExternalRefDto] })
  externalRefs?: ImportExternalRefDto[];

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiProperty({ enum: WorkType })
  mediumType!: WorkType;

  @ApiPropertyOptional({ maxLength: 120 })
  author?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  description?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  thumbnailUrl?: string;
}

export class ManualUserRecordIdentityV2Schema {
  @ApiProperty({ enum: ['manual'] })
  kind!: 'manual';

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiProperty({ enum: WorkType })
  mediumType!: WorkType;
}

@ApiExtraModels(
  CatalogUserRecordIdentityV2Schema,
  ExternalUserRecordIdentityV2Schema,
  ManualUserRecordIdentityV2Schema,
)
export class CreateUserRecordV2Dto {
  @ApiProperty({
    discriminator: {
      propertyName: 'kind',
      mapping: {
        catalog: getSchemaPath(CatalogUserRecordIdentityV2Schema),
        external: getSchemaPath(ExternalUserRecordIdentityV2Schema),
        manual: getSchemaPath(ManualUserRecordIdentityV2Schema),
      },
    },
    oneOf: [
      { $ref: getSchemaPath(CatalogUserRecordIdentityV2Schema) },
      { $ref: getSchemaPath(ExternalUserRecordIdentityV2Schema) },
      { $ref: getSchemaPath(ManualUserRecordIdentityV2Schema) },
    ],
  })
  @ValidateNested()
  @Type(() => UserRecordIdentityV2Dto)
  identity!:
    | CatalogUserRecordIdentityV2Schema
    | ExternalUserRecordIdentityV2Schema
    | ManualUserRecordIdentityV2Schema;

  @ApiPropertyOptional({ type: () => UpdateUserRecordDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserRecordDto)
  record?: UpdateUserRecordDto;
}
