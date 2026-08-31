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
  return (
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
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
  const { archiveScopeKey, isLoading, mode, sessionStatus } = useAuthSession();
  const activeScopeRef = useRef(archiveScopeKey);
  const activePullRef = useRef<{
    promise: Promise<void>;
    scopeKey: string;
  } | null>(null);
  const isPushRunningRef = useRef(false);
  const isPushRequestedRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPullAttemptAtRef = useRef(0);
  const pullFailureBackoffUntilRef = useRef(0);

  activeScopeRef.current = archiveScopeKey;

  useEffect(() => {
    if (
      isLoading ||
      mode !== 'authenticated' ||
      sessionStatus !== 'authenticated'
    ) {
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
      const activePull = activePullRef.current;

      if (activePull) {
        await activePull.promise;

        if (
          activePull.scopeKey !== scopeKey &&
          !isDisposed &&
          activeScopeRef.current === scopeKey
        ) {
          await runPull();
        }

        return;
      }

      if (
        isDisposed ||
        activeScopeRef.current !== scopeKey ||
        isBrowserOffline() ||
        isDocumentHidden() ||
        Date.now() < pullFailureBackoffUntilRef.current
      ) {
        return;
      }

      lastPullAttemptAtRef.current = Date.now();
      let shouldRetryPull = false;
      const pullPromise = (async () => {
        try {
          const result = await service.pullRemoteChanges();
          shouldRetryPull = result.requestFailed;

          pullFailureBackoffUntilRef.current = result.requestFailed
            ? Date.now() +
              Math.max(result.retryAfterMs ?? 0, pullFailureBackoffMs)
            : 0;
        } catch {
          shouldRetryPull = true;
          pullFailureBackoffUntilRef.current =
            Date.now() + pullFailureBackoffMs;
        }
      })();

      activePullRef.current = {
        promise: pullPromise,
        scopeKey,
      };

      try {
        await pullPromise;
      } finally {
        if (activePullRef.current?.promise === pullPromise) {
          activePullRef.current = null;
        }

        if (
          shouldRetryPull &&
          !isDisposed &&
          activeScopeRef.current === scopeKey
        ) {
          schedulePull();
        }
      }
    }

    function schedulePull() {
      clearPullTimer();

      const elapsedMs = Date.now() - lastPullAttemptAtRef.current;
      const minIntervalDelayMs =
        elapsedMs >= pullMinIntervalMs ? 0 : pullMinIntervalMs - elapsedMs;
      const backoffDelayMs = Math.max(
        0,
        pullFailureBackoffUntilRef.current - Date.now(),
      );

      pullTimerRef.current = setTimeout(
        () => {
          void runPull();
        },
        Math.max(minIntervalDelayMs, backoffDelayMs),
      );
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
    sessionStatus,
    pullMinIntervalMs,
    service,
  ]);

  useEffect(() => {
    if (
      isLoading ||
      mode !== 'authenticated' ||
      sessionStatus !== 'authenticated'
    ) {
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

    async function drainPushRequests() {
      if (isPushRunningRef.current) {
        return;
      }

      isPushRunningRef.current = true;

      try {
        while (isPushRequestedRef.current) {
          if (isDisposed || activeScopeRef.current !== scopeKey) {
            return;
          }

          if (isBrowserOffline() || isDocumentHidden()) {
            return;
          }

          isPushRequestedRef.current = false;
          while (activePullRef.current) {
            const activePull = activePullRef.current;
            await activePull.promise;
          }

          if (isDisposed || activeScopeRef.current !== scopeKey) {
            return;
          }

          if (isBrowserOffline() || isDocumentHidden()) {
            isPushRequestedRef.current = true;
            return;
          }

          try {
            const result = await service.pushQueuedChanges();

            if (
              result.requestFailed &&
              result.retryAfterMs !== undefined &&
              Number.isFinite(result.retryAfterMs) &&
              result.retryAfterMs >= 0
            ) {
              schedulePushDrain(Math.max(debounceMs, result.retryAfterMs));
              return;
            }
          } catch {
            // Push failures leave queue items pending for the next background retry.
          }
        }
      } finally {
        isPushRunningRef.current = false;
      }
    }

    function schedulePushDrain(delayMs: number) {
      clearPushTimer();

      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        isPushRequestedRef.current = true;
        void drainPushRequests();
      }, delayMs);
    }

    const subscription = liveQuery(() => queueRepository.listAll()).subscribe({
      next: (queueItems) => {
        clearPushTimer();

        const pushableItems = queueItems.filter((item) => !item.conflict);

        if (pushableItems.length === 0) {
          isPushRequestedRef.current = false;
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
          !hasReadyItem && earliestRetryAt > nowMs
            ? earliestRetryAt - nowMs
            : 0;

        schedulePushDrain(Math.max(debounceMs, retryDelayMs));
      },
      error: () => {
        clearPushTimer();
      },
    });
    const handlePushAvailability = () => {
      if (
        isPushRequestedRef.current &&
        pushTimerRef.current === null &&
        !isPushRunningRef.current &&
        !isBrowserOffline() &&
        !isDocumentHidden()
      ) {
        schedulePushDrain(debounceMs);
      }
    };

    const handlePushVisibilityChange = () => {
      if (!isDocumentHidden()) {
        handlePushAvailability();
      }
    };

    window.addEventListener('focus', handlePushAvailability);
    window.addEventListener('online', handlePushAvailability);
    document.addEventListener('visibilitychange', handlePushVisibilityChange);

    return () => {
      isDisposed = true;
      isPushRequestedRef.current = false;
      clearPushTimer();
      window.removeEventListener('focus', handlePushAvailability);
      window.removeEventListener('online', handlePushAvailability);
      document.removeEventListener(
        'visibilitychange',
        handlePushVisibilityChange,
      );
      subscription.unsubscribe();
    };
  }, [
    archiveScopeKey,
    debounceMs,
    isLoading,
    mode,
    queueRepository,
    service,
    sessionStatus,
  ]);
}
