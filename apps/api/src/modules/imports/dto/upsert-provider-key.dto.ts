import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpsertProviderKeyDto {
  @ApiProperty({
    additionalProperties: {
      type: 'string',
    },
    description: 'Provider-specific credential values keyed by field name.',
    example: {
      apiKey: 'provider-api-key',
    },
  })
  @IsObject()
  values!: Record<string, string>;
}
