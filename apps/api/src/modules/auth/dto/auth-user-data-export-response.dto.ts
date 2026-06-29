import { ApiProperty } from '@nestjs/swagger';

import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthUserDataExportResponseDto {
  @ApiProperty({
    format: 'date-time',
  })
  exportedAt!: string;

  @ApiProperty({
    type: AuthUserResponseDto,
  })
  user!: AuthUserResponseDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  counts!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  data!: Record<string, unknown>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
  })
  omittedSensitiveFields!: string[];
}
