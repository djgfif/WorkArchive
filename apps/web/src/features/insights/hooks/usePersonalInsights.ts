import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import { useAuthSession } from '@features/auth';
import {
  personalInsightsService,
  type PersonalInsights,
} from '../services/personal-insights.service';

interface PersonalInsightsState {
  error: string | null;
  insights: PersonalInsights | null;
  isLoading: boolean;
}

const initialState: PersonalInsightsState = {
  error: null,
  insights: null,
  isLoading: true,
};

export function usePersonalInsights() {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<PersonalInsightsState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: currentState.insights === null,
    }));

    const subscription = liveQuery(() =>
      personalInsightsService.getInsights(),
    ).subscribe({
      next: (insights) => {
        setState({
          error: null,
          insights,
          isLoading: false,
        });
      },
      error: (error) => {
        setState({
          error:
            error instanceof Error
              ? error.message
              : '인사이트를 불러오지 못했습니다.',
          insights: null,
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
