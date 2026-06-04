import type {
  WorkRecord,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import {
  getPersonalTags,
  worksRepository,
  type WorksRepository,
} from '@features/works';

const RECENT_WINDOW_DAYS = 30;

export interface PersonalInsights {
  addedRecentlyCount: number;
  averageRating: number | null;
  completedThisYearCount: number;
  droppedCount: number;
  favoriteCount: number;
  genreCounts: Array<{
    count: number;
    genre: string;
  }>;
  onHoldCount: number;
  plannedCount: number;
  ratingDistribution: Array<{
    count: number;
    rating: number;
  }>;
  recentlyAddedWorks: WorkRecord[];
  recentlyUpdatedWorks: WorkRecord[];
  reviewEmptyCount: number;
  statusCounts: Record<WorkStatus, number>;
  tagCounts: Array<{
    count: number;
    tag: string;
  }>;
  totalWorks: number;
  typeCounts: Record<WorkType, number>;
  updatedRecentlyCount: number;
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

function getTime(value: string | null | undefined) {
  return parseDate(value)?.getTime() ?? 0;
}

function isOnOrAfter(value: string | null | undefined, thresholdTime: number) {
  const parsed = parseDate(value);

  return parsed !== null && parsed.getTime() >= thresholdTime;
}

function sortCountSummaries(
  left: { count: number; label: string },
  right: { count: number; label: string },
) {
  return right.count - left.count || left.label.localeCompare(right.label);
}

function hasEmptyReview(work: WorkRecord) {
  return work.shortReview.trim() === '' && work.review.trim() === '';
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
  const currentYear = now.getFullYear();
  const recentThresholdTime =
    now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const work of activeWorks) {
    typeCounts[work.type] += 1;
    statusCounts[work.status] += 1;

    if (work.rating !== null) {
      ratingBuckets.set(work.rating, (ratingBuckets.get(work.rating) ?? 0) + 1);
    }

    for (const tag of getPersonalTags(work.personalTags)) {
      const normalizedTag = tag.trim();

      if (normalizedTag) {
        tagBuckets.set(normalizedTag, (tagBuckets.get(normalizedTag) ?? 0) + 1);
      }
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
  }

  return {
    addedRecentlyCount: activeWorks.filter((work) =>
      isOnOrAfter(work.createdAt, recentThresholdTime),
    ).length,
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
    droppedCount: statusCounts.dropped,
    favoriteCount: activeWorks.filter((work) => work.favorite).length,
    genreCounts: [...genreBuckets.entries()]
      .map(([genre, count]) => ({
        count,
        genre,
      }))
      .sort((left, right) =>
        sortCountSummaries(
          { count: left.count, label: left.genre },
          { count: right.count, label: right.genre },
        ),
      )
      .slice(0, 10),
    onHoldCount: statusCounts.on_hold,
    plannedCount: statusCounts.planned,
    ratingDistribution: [...ratingBuckets.entries()]
      .map(([rating, count]) => ({
        count,
        rating,
      }))
      .sort((left, right) => right.rating - left.rating),
    recentlyAddedWorks: [...activeWorks]
      .filter((work) => isOnOrAfter(work.createdAt, recentThresholdTime))
      .sort((left, right) => getTime(right.createdAt) - getTime(left.createdAt))
      .slice(0, 5),
    recentlyUpdatedWorks: [...activeWorks]
      .filter((work) => isOnOrAfter(work.updatedAt, recentThresholdTime))
      .sort((left, right) => getTime(right.updatedAt) - getTime(left.updatedAt))
      .slice(0, 5),
    reviewEmptyCount: activeWorks.filter(hasEmptyReview).length,
    statusCounts,
    tagCounts: [...tagBuckets.entries()]
      .map(([tag, count]) => ({
        count,
        tag,
      }))
      .sort((left, right) =>
        sortCountSummaries(
          { count: left.count, label: left.tag },
          { count: right.count, label: right.tag },
        ),
      )
      .slice(0, 10),
    totalWorks: activeWorks.length,
    typeCounts,
    updatedRecentlyCount: activeWorks.filter((work) =>
      isOnOrAfter(work.updatedAt, recentThresholdTime),
    ).length,
  };
}

export class PersonalInsightsService {
  constructor(private readonly repository: WorksRepository = worksRepository) {}

  async getInsights(now = new Date()) {
    const works = await this.repository.listActive();

    return calculatePersonalInsights(works, now);
  }
}

export const personalInsightsService = new PersonalInsightsService();
