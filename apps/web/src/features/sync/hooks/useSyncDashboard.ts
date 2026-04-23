import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type {
  SyncQueueItemRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { getWorkArchiveDb } from '../../works/db/work-archive.db';
import { appMetaRepository } from '../services/app-meta.repository';
import { syncQueueRepository } from '../services/sync-queue.repository';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';

interface SyncDashboardState {
  queueItems: SyncQueueItemRecord[];
  conflictWorks: WorkRecord[];
  lastSuccessfulPullAt: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SyncDashboardState = {
  queueItems: [],
  conflictWorks: [],
  lastSuccessfulPullAt: null,
  isLoading: true,
  error: null,
};

function isDatabaseClosedError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'DatabaseClosedError' ||
      error.message.includes('Database has been closed'))
  );
}

export function useSyncDashboard() {
  const { archiveScopeKey } = useAuthSession();
  const [state, setState] = useState<SyncDashboardState>(initialState);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      try {
        const db = getWorkArchiveDb();
        const [queueItems, conflictWorks, lastSuccessfulPullAt] =
          await Promise.all([
            syncQueueRepository.listAll(),
            db.works
              .filter((work) => work.syncStatus === 'conflict')
              .toArray(),
            appMetaRepository.getValue(LAST_SUCCESSFUL_PULL_AT_KEY),
          ]);

        return {
          queueItems,
          conflictWorks: [...conflictWorks].sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          ),
          lastSuccessfulPullAt,
        };
      } catch (error) {
        if (isDatabaseClosedError(error)) {
          return {
            queueItems: [],
            conflictWorks: [],
            lastSuccessfulPullAt: null,
          };
        }

        throw error;
      }
    }).subscribe({
      next: ({ queueItems, conflictWorks, lastSuccessfulPullAt }) => {
        setState({
          queueItems,
          conflictWorks,
          lastSuccessfulPullAt,
          isLoading: false,
          error: null,
        });
      },
      error: (error) => {
        setState({
          queueItems: [],
          conflictWorks: [],
          lastSuccessfulPullAt: null,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : '동기화 정보를 불러오지 못했습니다.',
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  return state;
}
