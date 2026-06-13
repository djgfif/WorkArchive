import { liveQuery } from 'dexie';
import { useEffect, useRef } from 'react';

import { useAuthSession } from '@features/auth';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../services/sync-queue.repository';
import { syncService, type SyncService } from '../services/sync.service';

const AUTO_SYNC_DEBOUNCE_MS = 1_200;
const AUTO_PULL_MIN_INTERVAL_MS = 30_000;
const AUTO_PULL_FAILURE_BACKOFF_MS = 5 * 60 * 1000;

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

interface UseAutoSyncOptions {
  debounceMs?: number;
  pullFailureBackoffMs?: number;
  pullMinIntervalMs?: number;
  queueRepository?: SyncQueueRepository;
  service?: SyncService;
}

export function useAutoSync({
  debounceMs = AUTO_SYNC_DEBOUNCE_MS,
  pullFailureBackoffMs = AUTO_PULL_FAILURE_BACKOFF_MS,
  pullMinIntervalMs = AUTO_PULL_MIN_INTERVAL_MS,
  queueRepository = syncQueueRepository,
  service = syncService,
}: UseAutoSyncOptions = {}) {
  const { archiveScopeKey, isLoading, mode } = useAuthSession();
  const activeScopeRef = useRef(archiveScopeKey);
  const isPushRunningRef = useRef(false);
  const isPullRunningRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPullAttemptAtRef = useRef(0);
  const pullFailureBackoffUntilRef = useRef(0);

  activeScopeRef.current = archiveScopeKey;

  useEffect(() => {
    if (isLoading || mode !== 'authenticated') {
      return undefined;
    }

    let isDisposed = false;
    const scopeKey = archiveScopeKey;

    function clearPullTimer() {
      if (pullTimerRef.current !== null) {
        clearTimeout(pullTimerRef.current);
        pullTimerRef.current = null;
      }
    }

    async function runPull() {
      if (
        isDisposed ||
        activeScopeRef.current !== scopeKey ||
        isPullRunningRef.current ||
        isBrowserOffline() ||
        isDocumentHidden() ||
        Date.now() < pullFailureBackoffUntilRef.current
      ) {
        return;
      }

      isPullRunningRef.current = true;
      lastPullAttemptAtRef.current = Date.now();

      try {
        const result = await service.pullRemoteChanges();

        pullFailureBackoffUntilRef.current = result.requestFailed
          ? Date.now() + pullFailureBackoffMs
          : 0;
      } catch {
        // Pull failures stay quiet; the next focus or reconnect attempts the background pull again.
        pullFailureBackoffUntilRef.current = Date.now() + pullFailureBackoffMs;
      } finally {
        isPullRunningRef.current = false;
      }
    }

    function schedulePull() {
      clearPullTimer();

      const elapsedMs = Date.now() - lastPullAttemptAtRef.current;
      const minIntervalDelayMs =
        elapsedMs >= pullMinIntervalMs
          ? 0
          : pullMinIntervalMs - elapsedMs;
      const backoffDelayMs = Math.max(
        0,
        pullFailureBackoffUntilRef.current - Date.now(),
      );

      pullTimerRef.current = setTimeout(() => {
        void runPull();
      }, Math.max(minIntervalDelayMs, backoffDelayMs));
    }

    schedulePull();

    const handleReconnectOrFocus = () => {
      schedulePull();
    };

    const handleVisibilityChange = () => {
      if (!isDocumentHidden()) {
        schedulePull();
      }
    };

    window.addEventListener('focus', handleReconnectOrFocus);
    window.addEventListener('online', handleReconnectOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      clearPullTimer();
      window.removeEventListener('focus', handleReconnectOrFocus);
      window.removeEventListener('online', handleReconnectOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    archiveScopeKey,
    isLoading,
    mode,
    pullFailureBackoffMs,
    pullMinIntervalMs,
    service,
  ]);

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

        const pushableItems = queueItems.filter((item) => !item.conflict);

        if (pushableItems.length === 0) {
          return;
        }

        const nowMs = Date.now();
        const hasReadyItem = pushableItems.some((item) => {
          if (!item.nextRetryAt) {
            return true;
          }

          const nextRetryAtMs = Date.parse(item.nextRetryAt);

          return !Number.isFinite(nextRetryAtMs) || nextRetryAtMs <= nowMs;
        });
        const nextRetryAtTimes = pushableItems
          .map((item) =>
            item.nextRetryAt ? Date.parse(item.nextRetryAt) : Number.NaN,
          )
          .filter(Number.isFinite);
        const earliestRetryAt =
          nextRetryAtTimes.length > 0 ? Math.min(...nextRetryAtTimes) : 0;
        const retryDelayMs =
          !hasReadyItem && earliestRetryAt > nowMs ? earliestRetryAt - nowMs : 0;

        pushTimerRef.current = setTimeout(() => {
          void runPush();
        }, Math.max(debounceMs, retryDelayMs));
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
