import type { WorkRecord } from '@work-archive/shared-types';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { worksRepository } from '../services/works.repository';

interface WorksOverviewState {
  averageRating: number | null;
  completedCount: number;
  deletedCount: number;
  error: string | null;
  inProgressCount: number;
  isLoading: boolean;
  pausedOrDroppedCount: number;
  recentWorks: WorkRecord[];
  totalCount: number;
}

const initialState: WorksOverviewState = {
  averageRating: null,
  completedCount: 0,
  deletedCount: 0,
  error: null,
  inProgressCount: 0,
  isLoading: true,
  pausedOrDroppedCount: 0,
  recentWorks: [],
  totalCount: 0,
};

function compareUpdatedAtDescending(left: WorkRecord, right: WorkRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function useWorksOverview() {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<WorksOverviewState>(initialState);

  useEffect(() => {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: currentState.totalCount === 0,
    }));

    const subscription = liveQuery(async () => {
      const [works, deletedWorks] = await Promise.all([
        worksRepository.listActive(),
        worksRepository.listDeleted(),
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
        deletedCount: deletedWorks.length,
        inProgressCount: works.filter((work) => work.status === 'in_progress').length,
        pausedOrDroppedCount: works.filter(
          (work) => work.status === 'paused' || work.status === 'dropped',
        ).length,
        recentWorks: [...works].sort(compareUpdatedAtDescending).slice(0, 6),
        totalCount: works.length,
      };
    }).subscribe({
      next: ({
        averageRating,
        completedCount,
        deletedCount,
        inProgressCount,
        pausedOrDroppedCount,
        recentWorks,
        totalCount,
      }) => {
        setState({
          averageRating,
          completedCount,
          deletedCount,
          error: null,
          inProgressCount,
          isLoading: false,
          pausedOrDroppedCount,
          recentWorks,
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
  }, [archiveScopeKey]);

  return state;
}
