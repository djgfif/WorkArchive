import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const WORK_GROUP_FIELDS = [
  'franchise',
  'medium',
  'contributor',
  'status',
] as const;

export class GroupedWorksQueryDto {
  @ApiProperty({
    enum: WORK_GROUP_FIELDS,
  })
  @IsIn(WORK_GROUP_FIELDS)
  by!: (typeof WORK_GROUP_FIELDS)[number];
}
