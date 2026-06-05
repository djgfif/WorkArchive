import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const ALADIN_TTBKEY_MAX_LENGTH = 300;

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export class UpsertAladinKeyDto {
  @ApiProperty({
    description: 'Aladin OpenAPI TTBKey.',
    maxLength: ALADIN_TTBKEY_MAX_LENGTH,
    required: false,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(ALADIN_TTBKEY_MAX_LENGTH)
  ttbKey?: string;

  @ApiProperty({
    description:
      'Compatibility shape used by the generic provider credential endpoint.',
    required: false,
  })
  @IsOptional()
  @IsObject()
  values?: {
    ttbKey?: string;
  };
}
