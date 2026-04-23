import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export class UpsertAladinKeyDto {
  @ApiProperty({
    description: 'Aladin OpenAPI TTBKey.',
    maxLength: 300,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  ttbKey!: string;
}
