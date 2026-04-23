import { ApiProperty } from '@nestjs/swagger';

import { IMPORT_PROVIDER_VALUES, type ImportProvider } from '../imports.constants';

export class ImportProviderStatusResponseDto {
  @ApiProperty({
    enum: IMPORT_PROVIDER_VALUES,
  })
  provider!: ImportProvider;

  @ApiProperty()
  configured!: boolean;

  @ApiProperty()
  label?: string;

  @ApiProperty()
  credentialMode?: 'none' | 'server' | 'user';

  @ApiProperty({
    type: [String],
  })
  mediumTypes?: string[];
}
