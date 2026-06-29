import { ApiProperty } from '@nestjs/swagger';

export class AuthAccountDeletionResponseDto {
  @ApiProperty({
    example: true,
  })
  deleted!: true;

  @ApiProperty({
    format: 'date-time',
  })
  deletedAt!: string;

  @ApiProperty({
    description:
      'The deleted user id. Returned once so clients can reconcile local state.',
  })
  userId!: string;

  @ApiProperty({
    description:
      'Retained operational records that were detached from the deleted user.',
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  anonymizedRecords!: Record<string, number>;
}
