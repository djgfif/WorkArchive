import { ApiProperty } from '@nestjs/swagger';

import { IMPORT_PROVIDER_VALUES, type ImportProvider } from '../imports.constants';

class ImportProviderCredentialFieldDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    required: false,
  })
  description?: string;

  @ApiProperty({
    required: false,
  })
  secret?: boolean;
}

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
    required: false,
    type: [ImportProviderCredentialFieldDto],
  })
  credentialFields?: ImportProviderCredentialFieldDto[];

  @ApiProperty({
    type: [String],
  })
  mediumTypes?: string[];
}
