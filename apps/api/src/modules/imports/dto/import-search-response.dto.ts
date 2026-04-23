import { ApiProperty } from '@nestjs/swagger';

import { IMPORT_PROVIDER_VALUES, type ImportProvider } from '../imports.constants';
import { ImportCandidateResponseDto } from './import-candidate-response.dto';

export class ImportSearchResponseDto {
  @ApiProperty({
    enum: IMPORT_PROVIDER_VALUES,
  })
  provider!: ImportProvider;

  @ApiProperty({
    enum: IMPORT_PROVIDER_VALUES,
    isArray: true,
  })
  providers!: string[];

  @ApiProperty()
  query!: string;

  @ApiProperty({
    type: ImportCandidateResponseDto,
    isArray: true,
  })
  candidates!: ImportCandidateResponseDto[];
}
