import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { graphRepository } from '../services/graph.repository';
import { worksRepository } from '../services/works.repository';
import {
  buildContributorCollectionSummariesFromGraph,
  buildContributorCollectionSummaries,
  buildSeriesCollectionSummariesFromGraph,
  buildSeriesCollectionSummaries,
  getPersonalTags,
  type WorkCollectionSummary,
} from '../utils/graph-tags';

interface CountSummary<T extends string = string> {
  count: number;
  label: string;
  value: T;
}

interface WorksOverviewState {
  averageRating: number | null;
  completedCount: number;
  contributorCollections: WorkCollectionSummary[];
  deletedCount: number;
  error: string | null;
  highlyRatedWorks: WorkRecord[];
  inProgressCount: number;
  isLoading: boolean;
  droppedCount: number;
  recentlyConsumedWorks: WorkRecord[];
  recentWorks: WorkRecord[];
  seriesCollections: WorkCollectionSummary[];
  statusCounts: Record<WorkStatus, number>;
  topTags: CountSummary[];
  totalCount: number;
  typeCounts: CountSummary<WorkType>[];
  unratedCount: number;
}

const initialState: WorksOverviewState = {
  averageRating: null,
  completedCount: 0,
  contributorCollections: [],
  deletedCount: 0,
  error: null,
  highlyRatedWorks: [],
  inProgressCount: 0,
  isLoading: true,
  droppedCount: 0,
  recentlyConsumedWorks: [],
  recentWorks: [],
  seriesCollections: [],
  statusCounts: {
    planned: 0,
    in_progress: 0,
    completed: 0,
    dropped: 0,
  },
  topTags: [],
  totalCount: 0,
  typeCounts: [],
  unratedCount: 0,
};

function compareUpdatedAtDescending(left: WorkRecord, right: WorkRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function compareLastConsumedAtDescending(left: WorkRecord, right: WorkRecord) {
  return (
    new Date(right.lastConsumedAt ?? right.updatedAt).getTime() -
    new Date(left.lastConsumedAt ?? left.updatedAt).getTime()
  );
}

function compareRatingDescending(left: WorkRecord, right: WorkRecord) {
  return (
    (right.rating ?? -1) - (left.rating ?? -1) ||
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function buildStatusCounts(works: WorkRecord[]): Record<WorkStatus, number> {
  return works.reduce<Record<WorkStatus, number>>(
    (counts, work) => ({
      ...counts,
      [work.status]: counts[work.status] + 1,
    }),
    { ...initialState.statusCounts },
  );
}

function buildTypeCounts(works: WorkRecord[]): CountSummary<WorkType>[] {
  const counts = new Map<WorkType, number>();

  for (const work of works) {
    counts.set(work.type, (counts.get(work.type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({
      count,
      label: value,
      value,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function buildTopTags(works: WorkRecord[], limit = 6): CountSummary[] {
  const counts = new Map<string, number>();

  for (const work of works) {
    const tags = [...work.genres, ...getPersonalTags(work.personalTags)];

    for (const tag of tags.map((value) => value.trim()).filter(Boolean)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ count, label: value, value }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function useWorksOverview() {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<WorksOverviewState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: currentState.totalCount === 0,
    }));

    const subscription = liveQuery(async () => {
      const [works, deletedWorks, graph] = await Promise.all([
        worksRepository.listActive(),
        worksRepository.listDeleted(),
        graphRepository.listActiveGraph(),
      ]);
      const ratedWorks = works.filter((work) => work.rating !== null);
      const totalRating = ratedWorks.reduce(
        (sum, work) => sum + (work.rating ?? 0),
        0,
      );

      return {
        averageRating:
          ratedWorks.length > 0 ? totalRating / ratedWorks.length : null,
        completedCount: works.filter((work) => work.status === 'completed').length,
        contributorCollections:
          graph.workContributors.length > 0
            ? buildContributorCollectionSummariesFromGraph(works, graph)
            : buildContributorCollectionSummaries(works),
        deletedCount: deletedWorks.length,
        highlyRatedWorks: [...ratedWorks].sort(compareRatingDescending).slice(0, 3),
        inProgressCount: works.filter((work) => work.status === 'in_progress').length,
        droppedCount: works.filter((work) => work.status === 'dropped').length,
        recentlyConsumedWorks: works
          .filter((work) => work.lastConsumedAt || work.lastConsumedLabel)
          .sort(compareLastConsumedAtDescending)
          .slice(0, 3),
        recentWorks: [...works].sort(compareUpdatedAtDescending).slice(0, 6),
        seriesCollections:
          graph.workSeriesLinks.length > 0
            ? buildSeriesCollectionSummariesFromGraph(works, graph)
            : buildSeriesCollectionSummaries(works),
        statusCounts: buildStatusCounts(works),
        topTags: buildTopTags(works),
        totalCount: works.length,
        typeCounts: buildTypeCounts(works),
        unratedCount: works.filter((work) => work.rating === null).length,
      };
    }).subscribe({
      next: ({
        averageRating,
        completedCount,
        contributorCollections,
        deletedCount,
        highlyRatedWorks,
        inProgressCount,
        droppedCount,
        recentlyConsumedWorks,
        recentWorks,
        seriesCollections,
        statusCounts,
        topTags,
        totalCount,
        typeCounts,
        unratedCount,
      }) => {
        setState({
          averageRating,
          completedCount,
          contributorCollections,
          deletedCount,
          error: null,
          highlyRatedWorks,
          inProgressCount,
          isLoading: false,
          droppedCount,
          recentlyConsumedWorks,
          recentWorks,
          seriesCollections,
          statusCounts,
          topTags,
          totalCount,
          typeCounts,
          unratedCount,
        });
      },
      error: (error) => {
        setState({
          ...initialState,
          error:
            error instanceof Error
              ? error.message
              : '요약 정보를 불러오지 못했습니다.',
          isLoading: false,
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, reloadKey]);

  return {
    ...state,
    retry: () => setReloadKey((currentKey) => currentKey + 1),
  };
}
