import type { WorkRecord } from '@work-archive/shared-types';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

import { useAuthSession } from '@features/auth';
import { recentWorkViewsService } from '../services/recent-work-views.service';
import { worksRepository } from '../services/works.repository';

export function useRecentWorkViews(limit = 8) {
  const { archiveScopeKey } = useAuthSession();
  const [works, setWorks] = useState<WorkRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const activeWorks = await worksRepository.listActive();

      return recentWorkViewsService
        .resolveWorks(archiveScopeKey, activeWorks)
        .slice(0, limit);
    }).subscribe({
      next: setWorks,
      error: () => setWorks([]),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, limit]);

  return works;
}
