import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import { useAuthSession } from '@features/auth';
import {
  worksService,
  type WorksCollectionScope,
} from '../services/works.service';
import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';

interface WorksListState {
  contributorSuggestions: string[];
  genreSuggestions: string[];
  organizationContributorSuggestions: string[];
  personContributorSuggestions: string[];
  seriesSuggestions: string[];
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  typeCounts: Record<WorkType, number>;
  recentModifiedWorks: WorkRecord[];
  works: WorkRecord[];
  totalActiveCount: number;
  totalDeletedCount: number;
  isLoading: boolean;
  error: string | null;
}

function buildEmptyStatusCounts(): Record<WorkStatus, number> {
  return {
    completed: 0,
    dropped: 0,
    in_progress: 0,
    planned: 0,
  };
}

function buildEmptyTypeCounts(): Record<WorkType, number> {
  return {
    anime: 0,
    drama: 0,
    light_novel: 0,
    manga: 0,
    movie: 0,
    novel: 0,
    other: 0,
    web_novel: 0,
    webtoon: 0,
  };
}

const initialState: WorksListState = {
  contributorSuggestions: [],
  genreSuggestions: [],
  organizationContributorSuggestions: [],
  personContributorSuggestions: [],
  seriesSuggestions: [],
  statusCounts: buildEmptyStatusCounts(),
  tagSuggestions: [],
  typeCounts: buildEmptyTypeCounts(),
  recentModifiedWorks: [],
  works: [],
  totalActiveCount: 0,
  totalDeletedCount: 0,
  isLoading: true,
  error: null,
};

export function useWorksList(
  query: WorksListQuery = DEFAULT_WORKS_LIST_QUERY,
  scope: WorksCollectionScope = 'active',
) {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<WorksListState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setState((previousState) => ({
      ...previousState,
      error: null,
      isLoading: previousState.works.length === 0,
    }));

    const subscription = liveQuery(() => worksService.listWorks(query, scope)).subscribe(
      {
        next: ({
          contributorSuggestions,
          genreSuggestions,
          organizationContributorSuggestions,
          personContributorSuggestions,
          recentModifiedWorks,
          seriesSuggestions,
          statusCounts,
          tagSuggestions,
          typeCounts,
          totalActiveCount,
          totalDeletedCount,
          works,
        }) => {
          setState({
            contributorSuggestions,
            genreSuggestions,
            organizationContributorSuggestions,
            personContributorSuggestions,
            recentModifiedWorks,
            seriesSuggestions,
            statusCounts,
            tagSuggestions,
            typeCounts,
            works,
            totalActiveCount,
            totalDeletedCount,
            isLoading: false,
            error: null,
          });
        },
        error: (error) => {
          setState({
            contributorSuggestions: [],
            genreSuggestions: [],
            organizationContributorSuggestions: [],
            personContributorSuggestions: [],
            recentModifiedWorks: [],
            seriesSuggestions: [],
            statusCounts: buildEmptyStatusCounts(),
            tagSuggestions: [],
            typeCounts: buildEmptyTypeCounts(),
            works: [],
            totalActiveCount: 0,
            totalDeletedCount: 0,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : '작품 목록을 불러오지 못했습니다.',
          });
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, query, reloadKey, scope]);

  return {
    ...state,
    retry: () => setReloadKey((currentKey) => currentKey + 1),
  };
}
