import { ApiProperty } from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

import type { CatalogReleaseCandidateInput } from '../../catalog/catalog-ingestion.service';

export class ImportCandidateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  sourceLabel!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    type: [String],
  })
  titleAliases!: string[];

  @ApiProperty()
  author!: string;

  @ApiProperty({
    enum: WorkType,
  })
  type!: WorkType;

  @ApiProperty({
    enum: WorkType,
  })
  mediumType!: WorkType;

  @ApiProperty({
    nullable: true,
  })
  subType!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  thumbnailUrl!: string;

  @ApiProperty()
  genresText!: string;

  @ApiProperty()
  formatLabel!: string;

  @ApiProperty()
  countLabel!: string;

  @ApiProperty()
  confidenceLabel!: string;

  @ApiProperty()
  note!: string;

  @ApiProperty()
  sourceUrl!: string;

  @ApiProperty({
    nullable: true,
  })
  franchiseName!: string | null;

  @ApiProperty({
    nullable: true,
  })
  releaseYear!: number | null;

  @ApiProperty({
    type: [Object],
  })
  contributors!: Array<{
    name: string;
    role: string;
  }>;

  @ApiProperty({
    type: [Object],
  })
  relationsHint!: Array<{
    relationType: string;
    targetTitle: string;
  }>;

  @ApiProperty({
    type: [Object],
  })
  externalRefs!: Array<{
    externalId: string;
    provider: string;
    rawType: string;
    url: string;
  }>;

  @ApiProperty({
    type: [Object],
  })
  releaseCandidates!: CatalogReleaseCandidateInput[];

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty({
    type: [Object],
  })
  scoreBreakdown!: Array<{
    label: string;
    weight: number;
  }>;

  @ApiProperty({
    type: Object,
  })
  sourceCoverage!: {
    externalIdentityCount: number;
    providerCount: number;
    providers: string[];
    releaseCandidateCount: number;
  };

  @ApiProperty({
    nullable: true,
  })
  existingRecord!: {
    id: string;
    status: string;
  } | null;

  @ApiProperty({
    nullable: true,
  })
  catalogMatch!: {
    id: string;
    title: string;
    verificationStatus: string;
  } | null;
}
