import { ApiProperty } from '@nestjs/swagger';

export type ImportProviderKeyTestFailureReason =
  | 'missing_key'
  | 'provider_unavailable'
  | 'unauthorized'
  | 'unknown';

export class ImportProviderKeyTestResponseDto {
  @ApiProperty({
    example: 'aladin',
  })
  provider!: string;

  @ApiProperty({
    example: true,
  })
  ok!: boolean;

  @ApiProperty({
    example: 'Provider API key connection test completed.',
  })
  message!: string;

  @ApiProperty({
    enum: ['missing_key', 'unauthorized', 'provider_unavailable', 'unknown'],
    nullable: true,
  })
  reason!: ImportProviderKeyTestFailureReason | null;

  @ApiProperty({
    example: '2026-05-20T12:00:00.000Z',
  })
  checkedAt!: string;
}
