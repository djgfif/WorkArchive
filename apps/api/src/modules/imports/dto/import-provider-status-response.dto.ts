import { ApiProperty } from '@nestjs/swagger';

import { ALADIN_PROVIDER } from '../imports.constants';

export class ImportProviderStatusResponseDto {
  @ApiProperty({
    enum: [ALADIN_PROVIDER],
  })
  provider!: typeof ALADIN_PROVIDER;

  @ApiProperty()
  configured!: boolean;
}
