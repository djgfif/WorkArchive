import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @ValidateIf((_, value) => value !== '')
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    { message: 'avatarUrl must be a valid URL.' },
  )
  avatarUrl?: string;

  @ApiProperty({
    example: 'Frieren',
    maxLength: 80,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  nickname!: string;

  @ApiProperty({
    example: 'frieren',
    nullable: true,
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-z0-9][a-z0-9_]*[a-z0-9]$/)
  handle!: string | null;
}
