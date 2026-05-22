import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { useAuthSession } from '../../auth';
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
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<WorkDetailState>(initialState);

  useEffect(() => {
    if (!id) {
      setState({
        work: null,
        isLoading: false,
        error: '작품 정보를 찾을 수 없습니다.',
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
            error instanceof Error
              ? error.message
              : '작품 정보를 불러오지 못했습니다.',
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, id]);

  return state;
}
