import { useEffect, useMemo, useState } from 'react';

import { useAuthSession } from '@features/auth';
import {
  getStoragePersistenceState,
  type StoragePersistenceState,
} from '@shared/runtime/persistent-storage';
import {
  getArchiveSafetyPresentation,
  getArchiveSafetyState,
} from '../utils/sync-safety-state';
import { useSyncDashboard } from './useSyncDashboard';

const UNKNOWN_STORAGE_STATE: StoragePersistenceState = {
  persisted: false,
  quotaBytes: null,
  supported: false,
  usageBytes: null,
};

export function useArchiveSafetyState() {
  const { archiveScopeKey, mode } = useAuthSession();
  const dashboard = useSyncDashboard();
  const [storageState, setStorageState] = useState<StoragePersistenceState>(
    UNKNOWN_STORAGE_STATE,
  );
  const [isStorageLoading, setIsStorageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getStoragePersistenceState()
      .then((nextState) => {
        if (!cancelled) {
          setStorageState(nextState);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsStorageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [archiveScopeKey]);

  const state = useMemo(
    () =>
      getArchiveSafetyState({
        activeRecordCount: dashboard.activeRecordCount,
        conflictCount: dashboard.conflictItems.length,
        failedCount: dashboard.failedItems.length,
        lastJsonBackupAt: dashboard.lastJsonBackupAt,
        lastSuccessfulPullAt: dashboard.lastSuccessfulPullAt,
        lastSuccessfulPushAt: dashboard.lastSuccessfulPushAt,
        mode,
        pendingCount: dashboard.pendingItems.length,
        requeuedCount: dashboard.pendingItems.filter(
          (item) => item.state === 'requeued',
        ).length,
        staleStatusAt: dashboard.staleStatusAt,
        storageState,
      }),
    [
      dashboard.activeRecordCount,
      dashboard.conflictItems.length,
      dashboard.failedItems.length,
      dashboard.lastJsonBackupAt,
      dashboard.lastSuccessfulPullAt,
      dashboard.lastSuccessfulPushAt,
      dashboard.pendingItems,
      dashboard.staleStatusAt,
      mode,
      storageState,
    ],
  );

  return {
    isLoading: dashboard.isLoading || isStorageLoading,
    presentation: getArchiveSafetyPresentation(state),
    state,
  };
}
