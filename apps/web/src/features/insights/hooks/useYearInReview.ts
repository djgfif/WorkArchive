import { useEffect, useState } from 'react';
import type { WorkRecord, WorkType } from '@work-archive/shared-types';

import { worksRepository } from '@features/works';

export interface YearInReview {
  year: number;
  completedCount: number;
  averageRating: number | null;
  topWorks: WorkRecord[];
  topGenre: { count: number; genre: string } | null;
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

/**
 * 로컬 아카이브로 계산하는 "올해의 결산" — 외부 호출 없이 IndexedDB 만으로.
 * Letterboxd Year in Review / Spotify Wrapped 패턴.
 */
export function useYearInReview(year = new Date().getFullYear()) {
  const [data, setData] = useState<YearInReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    worksRepository
      .listActive()
      .then((works) => {
        if (active) {
          setData(computeYearInReview(works, year));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setData(computeYearInReview([], year));
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [year]);

  return { data, isLoading };
}
