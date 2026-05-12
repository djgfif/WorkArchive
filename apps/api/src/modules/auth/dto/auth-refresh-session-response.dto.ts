import { ApiProperty } from '@nestjs/swagger';

export class AuthRefreshSessionResponseDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty()
  current!: boolean;

  @ApiProperty()
  rememberMe!: boolean;

  @ApiProperty({
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty({
    nullable: true,
  })
  ipAddress!: string | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
  })
  lastUsedAt!: string | null;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
  })
  rotatedAt!: string | null;

  @ApiProperty({
    format: 'date-time',
  })
  expiresAt!: string;
}

export class AuthRefreshSessionsResponseDto {
  @ApiProperty({
    type: () => [AuthRefreshSessionResponseDto],
  })
  sessions!: AuthRefreshSessionResponseDto[];
}
