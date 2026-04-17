import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import { worksService } from '../services/works.service';
import type { WorkRecord } from '@work-archive/shared-types';

interface WorksListState {
  works: WorkRecord[];
  isLoading: boolean;
  error: string | null;
}

const initialState: WorksListState = {
  works: [],
  isLoading: true,
  error: null,
};

export function useWorksList(query: WorksListQuery = DEFAULT_WORKS_LIST_QUERY) {
  const [state, setState] = useState<WorksListState>(initialState);

  useEffect(() => {
    setState((previousState) => ({
      ...previousState,
      error: null,
      isLoading: previousState.works.length === 0,
    }));

    const subscription = liveQuery(() => worksService.listWorks(query)).subscribe(
      {
        next: (works) => {
          setState({
            works,
            isLoading: false,
            error: null,
          });
        },
        error: (error) => {
          setState({
            works: [],
            isLoading: false,
            error:
              error instanceof Error ? error.message : 'Failed to load works.',
          });
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [query]);

  return state;
}
