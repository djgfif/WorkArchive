import { useEffect, useMemo, useState } from 'react';
import type { WorkRecord, WorkType } from '@work-archive/shared-types';

import { worksRepository } from '@features/works';

export interface YearInReview {
  year: number;
  completedCount: number;
  averageRating: number | null;
  topWorks: WorkRecord[];
  topGenre: { count: number; genre: string } | null;
  monthlyCompletedCounts: number[];
  typeBreakdown: Array<{ count: number; type: WorkType }>;
  busiestMonth: { count: number; month: number } | null;
}

function getCompletionDate(work: WorkRecord) {
  const value = work.completedAt ?? work.updatedAt;
  const parsed = value ? new Date(value) : null;

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

export function computeYearInReview(
  works: WorkRecord[],
  year: number,
): YearInReview {
  const completed = works.filter((work) => {
    if (work.deletedAt !== null || work.status !== 'completed') {
      return false;
    }

    const date = getCompletionDate(work);

    return date !== null && date.getFullYear() === year;
  });

  const rated = completed.filter((work) => work.rating !== null);
  const averageRating =
    rated.length > 0
      ? rated.reduce((sum, work) => sum + (work.rating ?? 0), 0) / rated.length
      : null;

  const genreBuckets = new Map<string, number>();
  const typeBuckets = new Map<WorkType, number>();
  const monthBuckets = new Array<number>(12).fill(0);

  for (const work of completed) {
    for (const genre of work.genres) {
      const trimmed = genre.trim();
      if (trimmed) {
        genreBuckets.set(trimmed, (genreBuckets.get(trimmed) ?? 0) + 1);
      }
    }

    typeBuckets.set(work.type, (typeBuckets.get(work.type) ?? 0) + 1);

    const date = getCompletionDate(work);
    if (date) {
      const monthIndex = date.getMonth();
      monthBuckets[monthIndex] = (monthBuckets[monthIndex] ?? 0) + 1;
    }
  }

  const topGenreEntry = [...genreBuckets.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];
  const busiestMonthIndex = monthBuckets.reduce(
    (bestIndex, count, index, all) =>
      count > (all[bestIndex] ?? 0) ? index : bestIndex,
    0,
  );
  const busiestMonthCount = monthBuckets[busiestMonthIndex] ?? 0;

  return {
    year,
    completedCount: completed.length,
    averageRating,
    topWorks: [...completed]
      .sort(
        (left, right) =>
          (right.rating ?? -1) - (left.rating ?? -1) ||
          (getCompletionDate(right)?.getTime() ?? 0) -
            (getCompletionDate(left)?.getTime() ?? 0),
      )
      .slice(0, 3),
    monthlyCompletedCounts: monthBuckets,
    topGenre: topGenreEntry
      ? { count: topGenreEntry[1], genre: topGenreEntry[0] }
      : null,
    typeBreakdown: [...typeBuckets.entries()]
      .map(([type, count]) => ({ count, type }))
      .sort((left, right) => right.count - left.count),
    busiestMonth:
      completed.length > 0 && busiestMonthCount > 0
        ? { count: busiestMonthCount, month: busiestMonthIndex + 1 }
        : null,
  };
}

export interface YearInReviewComparison {
  averageRatingDelta: number | null;
  completedDelta: number;
  previous: YearInReview;
}

export function getYearInReviewYears(
  works: WorkRecord[],
  fallbackYear: number,
) {
  const years = new Set<number>();

  for (const work of works) {
    if (work.deletedAt !== null || work.status !== 'completed') {
      continue;
    }

    const completionDate = getCompletionDate(work);

    if (completionDate) {
      years.add(completionDate.getFullYear());
    }
  }

  if (years.size === 0) {
    years.add(fallbackYear);
  }

  return [...years].sort((left, right) => right - left);
}

export function computeYearInReviewComparison(
  works: WorkRecord[],
  year: number,
  availableYears = getYearInReviewYears(works, year),
): YearInReviewComparison | null {
  const previousYear = availableYears.find((candidate) => candidate < year);

  if (previousYear === undefined) {
    return null;
  }

  const current = computeYearInReview(works, year);
  const previous = computeYearInReview(works, previousYear);

  return {
    averageRatingDelta:
      current.averageRating !== null && previous.averageRating !== null
        ? current.averageRating - previous.averageRating
        : null,
    completedDelta: current.completedCount - previous.completedCount,
    previous,
  };
}

/**
 * 로컬 아카이브로 계산하는 "올해의 결산" — 외부 호출 없이 IndexedDB 만으로.
 * Letterboxd Year in Review / Spotify Wrapped 패턴.
 */
export function useYearInReview(year = new Date().getFullYear()) {
  const [works, setWorks] = useState<WorkRecord[] | null>(null);

  useEffect(() => {
    let active = true;

    worksRepository
      .listActive()
      .then((records) => {
        if (active) {
          setWorks(records);
        }
      })
      .catch(() => {
        if (active) {
          setWorks([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const availableYears = useMemo(
    () => (works ? getYearInReviewYears(works, year) : [year]),
    [works, year],
  );
  const effectiveYear = availableYears.includes(year)
    ? year
    : (availableYears[0] ?? year);
  const data = useMemo(
    () => (works ? computeYearInReview(works, effectiveYear) : null),
    [effectiveYear, works],
  );
  const comparison = useMemo(
    () =>
      works
        ? computeYearInReviewComparison(works, effectiveYear, availableYears)
        : null,
    [availableYears, effectiveYear, works],
  );

  return {
    availableYears,
    comparison,
    data,
    isLoading: works === null,
  };
}
