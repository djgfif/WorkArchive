import { ApiProperty } from '@nestjs/swagger';

import { ALADIN_PROVIDER } from '../imports.constants';
import { ImportCandidateResponseDto } from './import-candidate-response.dto';

export class ImportSearchResponseDto {
  @ApiProperty({
    enum: [ALADIN_PROVIDER],
  })
  provider!: typeof ALADIN_PROVIDER;

  @ApiProperty()
  query!: string;

  @ApiProperty({
    type: ImportCandidateResponseDto,
    isArray: true,
  })
  candidates!: ImportCandidateResponseDto[];
}
