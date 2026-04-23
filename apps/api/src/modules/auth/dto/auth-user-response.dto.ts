import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
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
  })
  nickname!: string;

  @ApiProperty({
    enum: ['user', 'moderator', 'admin'],
  })
  role!: 'user' | 'moderator' | 'admin';
}
