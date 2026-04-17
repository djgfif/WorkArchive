import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { worksService } from '../services/works.service';

interface WorkDetailState {
  work: WorkRecord | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: WorkDetailState = {
  work: null,
  isLoading: true,
  error: null,
};

export function useWorkDetail(id: string | undefined) {
  const [state, setState] = useState<WorkDetailState>(initialState);

  useEffect(() => {
    if (!id) {
      setState({
        work: null,
        isLoading: false,
        error: 'Work id is missing.',
      });

      return undefined;
    }

    setState((previousState) => ({
      ...previousState,
      error: null,
      isLoading: previousState.work === null,
    }));

    const subscription = liveQuery(() => worksService.getWorkById(id)).subscribe({
      next: (work) => {
        setState({
          work,
          isLoading: false,
          error: null,
        });
      },
      error: (error) => {
        setState({
          work: null,
          isLoading: false,
          error:
            error instanceof Error ? error.message : 'Failed to load this work.',
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  return state;
}
