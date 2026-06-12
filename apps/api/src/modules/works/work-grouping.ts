import type { WorkResponseDto } from './dto/work-response.dto';
import type { WORK_GROUP_FIELDS } from './dto/grouped-works-query.dto';
import { toFlatWorkResponse } from './work-aggregate';
import type { WorkAggregate } from '../user-records/user-records.service';

export type WorkGroupField = (typeof WORK_GROUP_FIELDS)[number];

interface WorkGroupKey {
  key: string;
  label: string;
}

export interface FlatWorkGroup extends WorkGroupKey {
  count: number;
  works: WorkResponseDto[];
}

export function groupWorksBy(
  works: WorkAggregate[],
  by: WorkGroupField,
): FlatWorkGroup[] {
  const groups = new Map<string, Omit<FlatWorkGroup, 'count'>>();

  for (const work of works) {
    const group = getWorkGroupKey(work, by);
    const existing = groups.get(group.key);

    if (existing) {
      existing.works.push(toFlatWorkResponse(work));
      continue;
    }

    groups.set(group.key, {
      ...group,
      works: [toFlatWorkResponse(work)],
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    count: group.works.length,
  }));
}

function getWorkGroupKey(work: WorkAggregate, by: WorkGroupField): WorkGroupKey {
  if (by === 'status') {
    return {
      key: work.status,
      label: work.status,
    };
  }

  if (by === 'medium') {
    const mediumType = work.catalogTitle?.mediumType ?? work.catalogWork.type;

    return {
      key: mediumType,
      label: mediumType,
    };
  }

  if (by === 'franchise') {
    const franchise = work.catalogTitle?.franchise;

    return {
      key: franchise?.id ?? 'unfranchised',
      label: franchise?.displayName ?? '프랜차이즈 미지정',
    };
  }

  const contributor = work.catalogTitle?.contributors[0]?.contributor;

  return {
    key: contributor?.id ?? 'unknown-contributor',
    label:
      contributor?.displayName ?? (work.catalogWork.author || '기여자 미지정'),
  };
}
