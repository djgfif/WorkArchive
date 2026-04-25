import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PasswordResetRequestResponseDto {
  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({
    description: 'Development-only reset URL. It is omitted unless explicitly enabled.',
  })
  developmentResetUrl?: string;
}

export class PasswordResetConfirmResponseDto {
  @ApiProperty()
  message!: string;
}
