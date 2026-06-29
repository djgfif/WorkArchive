import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthAccountDeletionRequestDto {
  @ApiProperty({
    description: 'Current account email, used as an irreversible action check.',
    example: 'frieren@example.com',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  confirmEmail!: string;

  @ApiProperty({
    description: 'Must be true to confirm server-side account deletion.',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  acknowledgeIrreversible!: true;
}
