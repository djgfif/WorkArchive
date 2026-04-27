import { ApiProperty } from '@nestjs/swagger';

import {
  IMPORT_PROVIDER_VALUES,
  type ImportProvider,
} from '../imports.constants';
import {
  IMPORT_SEARCH_DIAGNOSTIC_STATUSES,
  type ImportSearchDiagnostics,
} from '../import-search-diagnostics';
import { ImportCandidateResponseDto } from './import-candidate-response.dto';

class ImportSearchProviderDiagnosticDto {
  @ApiProperty({
    enum: IMPORT_PROVIDER_VALUES,
  })
  provider!: ImportProvider;

  @ApiProperty({
    enum: IMPORT_SEARCH_DIAGNOSTIC_STATUSES,
  })
  status!: 'searched' | 'skipped' | 'failed';

  @ApiProperty()
  credentialMode!: 'none' | 'server' | 'user';

  @ApiProperty()
  configured!: boolean;

  @ApiProperty()
  resultCount!: number;

  @ApiProperty({
    nullable: true,
  })
  reasonCode!: string | null;

  @ApiProperty()
  message!: string;
}

class ImportSearchDiagnosticsDto {
  @ApiProperty({
    type: ImportSearchProviderDiagnosticDto,
    isArray: true,
  })
  providers!: ImportSearchProviderDiagnosticDto[];
}

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

  @ApiProperty({
    type: ImportSearchDiagnosticsDto,
  })
  diagnostics!: ImportSearchDiagnostics;
}
