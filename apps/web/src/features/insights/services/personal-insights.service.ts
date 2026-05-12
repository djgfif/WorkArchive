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
  droppedRate: number;
  favoriteCount: number;
  genreCounts: Array<{
    count: number;
    genre: string;
  }>;
  monthlyCompletedCounts: Array<{
    count: number;
    month: number;
  }>;
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
  staleWorks: WorkRecord[];
  topRatedThisYearWorks: WorkRecord[];
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

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameYear(value: string | null | undefined, year: number) {
  const parsed = parseDate(value);

  return parsed !== null && parsed.getFullYear() === year;
}

function getMonthInYear(value: string | null | undefined, year: number) {
  const parsed = parseDate(value);

  return parsed !== null && parsed.getFullYear() === year
    ? parsed.getMonth() + 1
    : null;
}

function getActivityTime(work: WorkRecord) {
  return (
    parseDate(work.lastConsumedAt)?.getTime() ??
    parseDate(work.startedAt)?.getTime() ??
    parseDate(work.updatedAt)?.getTime() ??
    0
  );
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
  const genreBuckets = new Map<string, number>();
  const monthlyCompletedBuckets = new Map<number, number>(
    Array.from({ length: 12 }, (_, index) => [index + 1, 0]),
  );
  const currentYear = now.getFullYear();
  const staleThresholdTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  for (const work of activeWorks) {
    typeCounts[work.type] += 1;
    statusCounts[work.status] += 1;

    if (work.rating !== null) {
      ratingBuckets.set(work.rating, (ratingBuckets.get(work.rating) ?? 0) + 1);
    }

    for (const tag of work.personalTags) {
      tagBuckets.set(tag, (tagBuckets.get(tag) ?? 0) + 1);
    }

    for (const genre of work.genres) {
      const normalizedGenre = genre.trim();

      if (normalizedGenre) {
        genreBuckets.set(
          normalizedGenre,
          (genreBuckets.get(normalizedGenre) ?? 0) + 1,
        );
      }
    }

    if (work.status === 'completed') {
      const completedMonth = getMonthInYear(
        work.completedAt ?? work.updatedAt,
        currentYear,
      );

      if (completedMonth !== null) {
        monthlyCompletedBuckets.set(
          completedMonth,
          (monthlyCompletedBuckets.get(completedMonth) ?? 0) + 1,
        );
      }
    }
  }

  const topRatedWorks = [...ratedWorks].sort(sortByRatingThenUpdatedAt);

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
        isSameYear(work.completedAt ?? work.updatedAt, currentYear),
    ).length,
    droppedRate:
      activeWorks.length > 0 ? statusCounts.dropped / activeWorks.length : 0,
    favoriteCount: activeWorks.filter((work) => work.favorite).length,
    genreCounts: [...genreBuckets.entries()]
      .map(([genre, count]) => ({
        count,
        genre,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    monthlyCompletedCounts: [...monthlyCompletedBuckets.entries()].map(
      ([month, count]) => ({
        count,
        month,
      }),
    ),
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
    staleWorks: activeWorks
      .filter(
        (work) =>
          (work.status === 'in_progress' || work.status === 'paused') &&
          getActivityTime(work) < staleThresholdTime,
      )
      .sort((left, right) => getActivityTime(left) - getActivityTime(right))
      .slice(0, 5),
    topRatedThisYearWorks: topRatedWorks
      .filter((work) => isSameYear(work.completedAt ?? work.updatedAt, currentYear))
      .slice(0, 5),
    topRatedWorks: topRatedWorks.slice(0, 5),
    typeCounts,
  };
}

function sortByRatingThenUpdatedAt(left: WorkRecord, right: WorkRecord) {
  return (
    (right.rating ?? 0) - (left.rating ?? 0) ||
    (parseDate(right.updatedAt)?.getTime() ?? 0) -
      (parseDate(left.updatedAt)?.getTime() ?? 0)
  );
}
