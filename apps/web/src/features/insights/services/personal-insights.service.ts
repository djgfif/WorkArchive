import type {
  TimelineEntryRecord,
  WorkRecord,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import {
  getPersonalTags,
  timelineEntriesRepository,
  type TimelineEntriesRepository,
  worksRepository,
  type WorksRepository,
} from '@features/works';

const ACTIVITY_WINDOW_DAYS = 28;
const RECENT_ACTIVITY_DAYS = 7;
const RECENT_WINDOW_DAYS = 30;

export interface PersonalInsights {
  activityActiveDayCount: number;
  activityDays: Array<{
    count: number;
    date: string;
  }>;
  activityLastRecordedAt: string | null;
  activityRecentRecordCount: number;
  activityRecordCount: number;
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
  repeatedThisYearCount: number;
  repeatedWorkCount: number;
  repeatRecordCount: number;
  reviewEmptyCount: number;
  statusCounts: Record<WorkStatus, number>;
  tagCounts: Array<{
    count: number;
    tag: string;
  }>;
  topRepeatedWorks: Array<{
    count: number;
    lastRepeatedAt: string;
    work: WorkRecord;
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

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + days,
  );
}

function getLocalDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildActivitySummary(
  entries: TimelineEntryRecord[],
  now: Date,
): Pick<
  PersonalInsights,
  | 'activityActiveDayCount'
  | 'activityDays'
  | 'activityLastRecordedAt'
  | 'activityRecentRecordCount'
  | 'activityRecordCount'
> {
  const today = startOfLocalDay(now);
  const activityStart = addLocalDays(today, -(ACTIVITY_WINDOW_DAYS - 1));
  const recentStart = addLocalDays(today, -(RECENT_ACTIVITY_DAYS - 1));
  const tomorrow = addLocalDays(today, 1);
  const dayBuckets = new Map<string, number>();

  for (let offset = 0; offset < ACTIVITY_WINDOW_DAYS; offset += 1) {
    dayBuckets.set(getLocalDateKey(addLocalDays(activityStart, offset)), 0);
  }

  let activityLastRecordedAt: string | null = null;
  let activityRecentRecordCount = 0;
  let activityRecordCount = 0;

  for (const entry of entries) {
    const occurredAt = parseDate(entry.occurredAt);

    if (!occurredAt || occurredAt >= tomorrow) {
      continue;
    }

    if (
      activityLastRecordedAt === null ||
      occurredAt.getTime() > getTime(activityLastRecordedAt)
    ) {
      activityLastRecordedAt = entry.occurredAt;
    }

    if (occurredAt < activityStart) {
      continue;
    }

    const dateKey = getLocalDateKey(occurredAt);
    dayBuckets.set(dateKey, (dayBuckets.get(dateKey) ?? 0) + 1);
    activityRecordCount += 1;

    if (occurredAt >= recentStart) {
      activityRecentRecordCount += 1;
    }
  }

  const activityDays = [...dayBuckets.entries()].map(([date, count]) => ({
    count,
    date,
  }));

  return {
    activityActiveDayCount: activityDays.filter((day) => day.count > 0).length,
    activityDays,
    activityLastRecordedAt,
    activityRecentRecordCount,
    activityRecordCount,
  };
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
  timelineEntries: TimelineEntryRecord[] = [],
): PersonalInsights {
  const activeWorks = works.filter((work) => work.deletedAt === null);
  const activeWorksById = new Map(activeWorks.map((work) => [work.id, work]));
  const activeTimelineEntries = timelineEntries.filter(
    (entry) => entry.deletedAt === null && activeWorksById.has(entry.workId),
  );
  const repeatEntries = activeTimelineEntries.filter(
    (entry) => entry.type === 'rewatch',
  );
  const activitySummary = buildActivitySummary(activeTimelineEntries, now);
  const repeatBuckets = new Map<
    string,
    { count: number; lastRepeatedAt: string }
  >();
  const typeCounts = createEmptyTypeCounts();
  const statusCounts = createEmptyStatusCounts();
  const ratedWorks = activeWorks.filter((work) => work.rating !== null);
  const ratingBuckets = new Map<number, number>();
  const tagBuckets = new Map<string, number>();
  const genreBuckets = new Map<string, number>();
  const currentYear = now.getFullYear();
  const recentThresholdTime =
    now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const entry of repeatEntries) {
    const current = repeatBuckets.get(entry.workId);

    if (!current) {
      repeatBuckets.set(entry.workId, {
        count: 1,
        lastRepeatedAt: entry.occurredAt,
      });
      continue;
    }

    current.count += 1;
    if (getTime(entry.occurredAt) > getTime(current.lastRepeatedAt)) {
      current.lastRepeatedAt = entry.occurredAt;
    }
  }

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
    ...activitySummary,
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
    repeatedThisYearCount: repeatEntries.filter((entry) =>
      isSameYear(entry.occurredAt, currentYear),
    ).length,
    repeatedWorkCount: repeatBuckets.size,
    repeatRecordCount: repeatEntries.length,
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
    topRepeatedWorks: [...repeatBuckets.entries()]
      .flatMap(([workId, summary]) => {
        const work = activeWorksById.get(workId);

        return work ? [{ ...summary, work }] : [];
      })
      .sort(
        (left, right) =>
          right.count - left.count ||
          getTime(right.lastRepeatedAt) - getTime(left.lastRepeatedAt) ||
          left.work.title.localeCompare(right.work.title),
      )
      .slice(0, 5),
    totalWorks: activeWorks.length,
    typeCounts,
    updatedRecentlyCount: activeWorks.filter((work) =>
      isOnOrAfter(work.updatedAt, recentThresholdTime),
    ).length,
  };
}

export class PersonalInsightsService {
  constructor(
    private readonly repository: WorksRepository = worksRepository,
    private readonly timelineRepository: TimelineEntriesRepository = timelineEntriesRepository,
  ) {}

  async getInsights(now = new Date()) {
    const activityStart = addLocalDays(
      startOfLocalDay(now),
      -(ACTIVITY_WINDOW_DAYS - 1),
    );
    const activityEnd = addLocalDays(startOfLocalDay(now), 1);
    const worksPromise = this.repository.listActive();
    const repeatEntriesPromise =
      this.timelineRepository.listActiveByType('rewatch');
    const recentEntriesPromise = this.timelineRepository.listActiveSince(
      activityStart.toISOString(),
    );
    const works = await worksPromise;
    const latestEntryPromise =
      this.timelineRepository.getLatestActiveForWorkIdsBefore(
        new Set(works.map((work) => work.id)),
        activityEnd.toISOString(),
      );
    const [repeatEntries, recentEntries, latestEntry] = await Promise.all([
      repeatEntriesPromise,
      recentEntriesPromise,
      latestEntryPromise,
    ]);
    const timelineEntries = new Map(
      [
        ...repeatEntries,
        ...recentEntries,
        ...(latestEntry ? [latestEntry] : []),
      ].map((entry) => [entry.id, entry]),
    );

    return calculatePersonalInsights(works, now, [...timelineEntries.values()]);
  }
}

export const personalInsightsService = new PersonalInsightsService();
