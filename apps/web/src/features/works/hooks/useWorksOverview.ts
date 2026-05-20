import type { WorkRecord } from '@work-archive/shared-types';
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
  type WorkCollectionSummary,
} from '../utils/graph-tags';

interface WorksOverviewState {
  averageRating: number | null;
  completedCount: number;
  contributorCollections: WorkCollectionSummary[];
  deletedCount: number;
  error: string | null;
  inProgressCount: number;
  isLoading: boolean;
  droppedCount: number;
  recentWorks: WorkRecord[];
  seriesCollections: WorkCollectionSummary[];
  totalCount: number;
}

const initialState: WorksOverviewState = {
  averageRating: null,
  completedCount: 0,
  contributorCollections: [],
  deletedCount: 0,
  error: null,
  inProgressCount: 0,
  isLoading: true,
  droppedCount: 0,
  recentWorks: [],
  seriesCollections: [],
  totalCount: 0,
};

function compareUpdatedAtDescending(left: WorkRecord, right: WorkRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
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
        inProgressCount: works.filter((work) => work.status === 'in_progress').length,
        droppedCount: works.filter((work) => work.status === 'dropped').length,
        recentWorks: [...works].sort(compareUpdatedAtDescending).slice(0, 6),
        seriesCollections:
          graph.workSeriesLinks.length > 0
            ? buildSeriesCollectionSummariesFromGraph(works, graph)
            : buildSeriesCollectionSummaries(works),
        totalCount: works.length,
      };
    }).subscribe({
      next: ({
        averageRating,
        completedCount,
        contributorCollections,
        deletedCount,
        inProgressCount,
        droppedCount,
        recentWorks,
        seriesCollections,
        totalCount,
      }) => {
        setState({
          averageRating,
          completedCount,
          contributorCollections,
          deletedCount,
          error: null,
          inProgressCount,
          isLoading: false,
          droppedCount,
          recentWorks,
          seriesCollections,
          totalCount,
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
