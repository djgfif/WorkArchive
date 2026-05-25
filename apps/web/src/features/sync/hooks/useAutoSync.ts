import { liveQuery } from 'dexie';
import { useEffect, useRef } from 'react';

import { useAuthSession } from '@features/auth';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../services/sync-queue.repository';
import { syncService, type SyncService } from '../services/sync.service';

const AUTO_SYNC_DEBOUNCE_MS = 1_200;

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

interface UseAutoSyncOptions {
  debounceMs?: number;
  queueRepository?: SyncQueueRepository;
  service?: SyncService;
}

export function useAutoSync({
  debounceMs = AUTO_SYNC_DEBOUNCE_MS,
  queueRepository = syncQueueRepository,
  service = syncService,
}: UseAutoSyncOptions = {}) {
  const { archiveScopeKey, isLoading, mode } = useAuthSession();
  const activeScopeRef = useRef(archiveScopeKey);
  const isPushRunningRef = useRef(false);
  const isPullRunningRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeScopeRef.current = archiveScopeKey;

  useEffect(() => {
    if (isLoading || mode !== 'authenticated') {
      return undefined;
    }

    let isDisposed = false;
    const scopeKey = archiveScopeKey;

    async function runPull() {
      if (
        isDisposed ||
        activeScopeRef.current !== scopeKey ||
        isPullRunningRef.current ||
        isBrowserOffline()
      ) {
        return;
      }

      isPullRunningRef.current = true;

      try {
        await service.pullRemoteChanges();
      } catch {
        // Pull failures stay quiet; the next focus or reconnect attempts the background pull again.
      } finally {
        isPullRunningRef.current = false;
      }
    }

    void runPull();

    const handleReconnectOrFocus = () => {
      void runPull();
    };

    window.addEventListener('focus', handleReconnectOrFocus);
    window.addEventListener('online', handleReconnectOrFocus);

    return () => {
      isDisposed = true;
      window.removeEventListener('focus', handleReconnectOrFocus);
      window.removeEventListener('online', handleReconnectOrFocus);
    };
  }, [archiveScopeKey, isLoading, mode, service]);

  useEffect(() => {
    if (isLoading || mode !== 'authenticated') {
      return undefined;
    }

    let isDisposed = false;
    const scopeKey = archiveScopeKey;

    function clearPushTimer() {
      if (pushTimerRef.current !== null) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    }

    async function runPush() {
      if (
        isDisposed ||
        activeScopeRef.current !== scopeKey ||
        isPushRunningRef.current ||
        isBrowserOffline() ||
        isDocumentHidden()
      ) {
        return;
      }

      isPushRunningRef.current = true;

      try {
        await service.pushQueuedChanges();
      } catch {
        // Push failures leave queue items pending for the next background retry.
      } finally {
        isPushRunningRef.current = false;
      }
    }

    const subscription = liveQuery(() => queueRepository.listAll()).subscribe({
      next: (queueItems) => {
        clearPushTimer();

        if (queueItems.length === 0) {
          return;
        }

        pushTimerRef.current = setTimeout(() => {
          void runPush();
        }, debounceMs);
      },
      error: () => {
        clearPushTimer();
      },
    });

    return () => {
      isDisposed = true;
      clearPushTimer();
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, debounceMs, isLoading, mode, queueRepository, service]);
}
