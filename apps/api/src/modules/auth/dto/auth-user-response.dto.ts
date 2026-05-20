import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        emailVerified: { type: 'boolean' },
        name: { type: 'string' },
        pictureUrl: { type: 'string' },
        provider: { type: 'string' },
      },
    },
  })
  authAccounts!: Array<{
    email: string;
    emailVerified: boolean;
    name: string;
    pictureUrl: string;
    provider: string;
  }>;

  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'frieren@example.com',
  })
  email!: string;

  @ApiProperty({
    example: '',
    nullable: true,
  })
  handle!: string | null;

  @ApiProperty({
    example: '',
  })
  nickname!: string;

  @ApiProperty({
    enum: ['user', 'moderator', 'admin'],
  })
  role!: 'user' | 'moderator' | 'admin';
}
