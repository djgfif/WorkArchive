import { Group, Paper, Stack, Text } from '@mantine/core';
import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';

import {
  recordAutomaticJsonBackupLocalChange,
  runAutomaticJsonBackupIfDue,
} from '@features/archive';
import { useAuthSession } from '@features/auth';
import { getWorkArchiveDb } from '@features/works';
import { AppButton } from '@shared/components/AppPrimitives';
import { ensurePersistentStorage } from '@shared/runtime/persistent-storage';
import { cn, cx } from '@shared/utils/class-names';
import styles from './PwaRuntime.module.css';

const AUTO_BACKUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_BACKUP_CHANGE_SETTLE_MS = 5 * 60 * 1000;

const css = styles;

async function getLatestLocalChangeFingerprint() {
  const db = getWorkArchiveDb();
  const [
    latestWork,
    latestRelease,
    latestTimeline,
    latestTierBoard,
    latestTierLane,
    latestTierCard,
    latestQueueItem,
  ] = await Promise.all([
    db.works.orderBy('updatedAt').last(),
    db.releaseRecords.orderBy('updatedAt').last(),
    db.timelineEntries.orderBy('updatedAt').last(),
    db.tierBoards.orderBy('updatedAt').last(),
    db.tierLanes.orderBy('updatedAt').last(),
    db.tierBoardCards.orderBy('updatedAt').last(),
    db.syncQueue.orderBy('createdAt').last(),
  ]);

  return [
    latestWork?.updatedAt,
    latestRelease?.updatedAt,
    latestTimeline?.updatedAt,
    latestTierBoard?.updatedAt,
    latestTierLane?.updatedAt,
    latestTierCard?.updatedAt,
    latestQueueItem?.createdAt,
  ]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}

export function LocalDataSafetyRuntime() {
  const { archiveScopeKey, isLoading } = useAuthSession();
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  useEffect(() => {
    ensurePersistentStorage();

    async function runBackupCheck() {
      try {
        const result = await runAutomaticJsonBackupIfDue();

        if (result) {
          setBackupNotice(null);
        }
      } catch (error) {
        setBackupNotice(
          error instanceof Error
            ? error.message
            : '자동 백업을 완료하지 못했습니다.',
        );
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void runBackupCheck();
      }
    }

    const handleFocus = () => void runBackupCheck();

    void runBackupCheck();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(
      () => void runBackupCheck(),
      AUTO_BACKUP_CHECK_INTERVAL_MS,
    );

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return undefined;
    }

    let hasInitialSnapshot = false;
    let disposed = false;

    function clearChangeTimer() {
      if (changeTimerRef.current !== null) {
        clearTimeout(changeTimerRef.current);
        changeTimerRef.current = null;
      }
    }

    async function runSettledBackupCheck() {
      try {
        const result = await runAutomaticJsonBackupIfDue();

        if (result) {
          setBackupNotice(null);
        }
      } catch (error) {
        setBackupNotice(
          error instanceof Error
            ? error.message
            : '자동 백업을 완료하지 못했습니다.',
        );
      }
    }

    function scheduleSettledBackupCheck() {
      clearChangeTimer();
      changeTimerRef.current = setTimeout(() => {
        void runSettledBackupCheck();
      }, AUTO_BACKUP_CHANGE_SETTLE_MS);
    }

    const subscription = liveQuery(getLatestLocalChangeFingerprint).subscribe({
      next: (fingerprint) => {
        if (disposed) {
          return;
        }

        if (!hasInitialSnapshot) {
          hasInitialSnapshot = true;
          return;
        }

        if (fingerprint === null) {
          return;
        }

        void recordAutomaticJsonBackupLocalChange().then(() => {
          if (!disposed && document.visibilityState === 'visible') {
            scheduleSettledBackupCheck();
          }
        }).catch(() => {
          // A later app-open check can refresh backup state if Dexie was briefly unavailable.
        });
      },
      error: () => {
        // Local change observation is best effort; explicit app-open checks still run.
      },
    });

    return () => {
      disposed = true;
      clearChangeTimer();
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, isLoading]);

  if (!backupNotice) {
    return null;
  }

  return (
    <Paper
      aria-live="polite"
      className={cx(css.notice, css.backupNotice)}
      p="md"
      radius="md"
      role="status"
      withBorder
    >
      <Stack gap="sm">
        <Stack gap={3}>
          <Text className={cn(css.noticeTitle)}>
            자동 폴더 백업 확인이 필요합니다
          </Text>
          <Text c="dimmed" size="sm">
            {backupNotice}
          </Text>
        </Stack>
        <Group className={cn(css.noticeActions)} gap="xs" justify="flex-end">
          <AppButton
            onClick={() => {
              window.location.assign('/account/settings#data-backup');
            }}
            size="compact-sm"
            tone="primary"
            type="button"
          >
            백업 설정 열기
          </AppButton>
          <AppButton
            onClick={() => setBackupNotice(null)}
            size="compact-sm"
            tone="quiet"
            type="button"
          >
            닫기
          </AppButton>
        </Group>
      </Stack>
    </Paper>
  );
}
