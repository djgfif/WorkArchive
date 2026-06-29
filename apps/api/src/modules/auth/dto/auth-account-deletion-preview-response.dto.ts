import { ApiProperty } from '@nestjs/swagger';

export class AuthAccountDeletionPreviewResponseDto {
  @ApiProperty({
    format: 'date-time',
  })
  generatedAt!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({
    description: 'Rows expected to be deleted by user-owned cascade paths.',
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  cascadeDeletedRecords!: Record<string, number>;

  @ApiProperty({
    description:
      'Rows expected to be retained but detached from the deleted user.',
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  anonymizedRecords!: Record<string, number>;

  @ApiProperty({
    description:
      'Sensitive categories intentionally omitted from deletion previews.',
    type: 'array',
    items: {
      type: 'string',
    },
  })
  omittedSensitiveFields!: string[];
}
