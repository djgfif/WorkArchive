import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import type {
  SyncQueueItemRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import { workArchiveDb } from '../../works/db/work-archive.db';
import { appMetaRepository } from '../services/app-meta.repository';
import { syncQueueRepository } from '../services/sync-queue.repository';

const LAST_SUCCESSFUL_PULL_AT_KEY = 'sync.lastSuccessfulPullAt';

interface SyncDashboardState {
  queueItems: SyncQueueItemRecord<WorkRecord>[];
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

export function useSyncDashboard() {
  const [state, setState] = useState<SyncDashboardState>(initialState);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [queueItems, conflictWorks, lastSuccessfulPullAt] =
        await Promise.all([
          syncQueueRepository.listAll(),
          workArchiveDb.works
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
              : 'Failed to load sync dashboard data.',
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
