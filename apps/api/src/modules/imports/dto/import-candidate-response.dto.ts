import { ApiProperty } from '@nestjs/swagger';
import { WorkType } from '@prisma/client';

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

  @ApiProperty()
  author!: string;

  @ApiProperty({
    enum: WorkType,
  })
  type!: WorkType;

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
}
