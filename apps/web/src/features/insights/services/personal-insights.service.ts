import type {
  WorkRecord,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';

export interface PersonalInsights {
  activeCount: number;
  averageRating: number | null;
  completedThisYearCount: number;
  favoriteCount: number;
  plannedOrInProgressCount: number;
  ratingDistribution: Array<{
    count: number;
    rating: number;
  }>;
  statusCounts: Record<WorkStatus, number>;
  tagCounts: Array<{
    count: number;
    tag: string;
  }>;
  topRatedWorks: WorkRecord[];
  typeCounts: Record<WorkType, number>;
}

function createEmptyTypeCounts(): Record<WorkType, number> {
  return Object.fromEntries(WORK_TYPES.map((type) => [type, 0])) as Record<
    WorkType,
    number
  >;
}

function createEmptyStatusCounts(): Record<WorkStatus, number> {
  return Object.fromEntries(
    WORK_STATUSES.map((status) => [status, 0]),
  ) as Record<WorkStatus, number>;
}

function isSameYear(value: string, year: number) {
  const parsed = new Date(value);

  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year;
}

export function calculatePersonalInsights(
  works: WorkRecord[],
  now = new Date(),
): PersonalInsights {
  const activeWorks = works.filter((work) => work.deletedAt === null);
  const typeCounts = createEmptyTypeCounts();
  const statusCounts = createEmptyStatusCounts();
  const ratedWorks = activeWorks.filter((work) => work.rating !== null);
  const ratingBuckets = new Map<number, number>();
  const tagBuckets = new Map<string, number>();

  for (const work of activeWorks) {
    typeCounts[work.type] += 1;
    statusCounts[work.status] += 1;

    if (work.rating !== null) {
      ratingBuckets.set(work.rating, (ratingBuckets.get(work.rating) ?? 0) + 1);
    }

    for (const tag of work.personalTags) {
      tagBuckets.set(tag, (tagBuckets.get(tag) ?? 0) + 1);
    }
  }

  return {
    activeCount: activeWorks.length,
    averageRating:
      ratedWorks.length > 0
        ? ratedWorks.reduce((sum, work) => sum + (work.rating ?? 0), 0) /
          ratedWorks.length
        : null,
    completedThisYearCount: activeWorks.filter(
      (work) =>
        work.status === 'completed' &&
        isSameYear(work.updatedAt, now.getFullYear()),
    ).length,
    favoriteCount: activeWorks.filter((work) => work.favorite).length,
    plannedOrInProgressCount: statusCounts.planned + statusCounts.in_progress,
    ratingDistribution: [...ratingBuckets.entries()]
      .map(([rating, count]) => ({
        count,
        rating,
      }))
      .sort((left, right) => right.rating - left.rating),
    statusCounts,
    tagCounts: [...tagBuckets.entries()]
      .map(([tag, count]) => ({
        count,
        tag,
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.tag.localeCompare(right.tag),
      )
      .slice(0, 10),
    topRatedWorks: [...ratedWorks]
      .sort(
        (left, right) =>
          (right.rating ?? 0) - (left.rating ?? 0) ||
          new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
      )
      .slice(0, 5),
    typeCounts,
  };
}
