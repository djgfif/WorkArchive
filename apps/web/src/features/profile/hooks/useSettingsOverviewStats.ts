import { useLiveQuery } from 'dexie-react-hooks';

import { LAST_JSON_EXPORT_AT_META_KEY } from '@features/archive';
import { getWorkArchiveDb, workArchiveDbManager } from '../../works/storage';

export interface SettingsOverviewStats {
  activeWorkCount: number;
  archiveScopeKey: string;
  autoMergedQueueItemCount: number;
  conflictQueueItemCount: number;
  currentOrigin: string;
  databaseName: string;
  deletedWorkCount: number;
  failedQueueItemCount: number;
  isNonStandardLocalOrigin: boolean;
  lastJsonExportAt: string | null;
  localOnlyWorkCount: number;
  releaseRecordCount: number;
  syncQueueItemCount: number;
  timelineEntryCount: number;
}

const STANDARD_LOCAL_WEB_ORIGIN = 'http://localhost:18730';

function getCurrentOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

function isLocalhostOrigin(origin: string) {
  try {
    const url = new URL(origin);

    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

const EMPTY_STATS: SettingsOverviewStats = {
  activeWorkCount: 0,
  archiveScopeKey: '',
  autoMergedQueueItemCount: 0,
  conflictQueueItemCount: 0,
  currentOrigin: '',
  databaseName: '',
  deletedWorkCount: 0,
  failedQueueItemCount: 0,
  isNonStandardLocalOrigin: false,
  lastJsonExportAt: null,
  localOnlyWorkCount: 0,
  releaseRecordCount: 0,
  syncQueueItemCount: 0,
  timelineEntryCount: 0,
};

export function useSettingsOverviewStats(archiveScopeKey: string) {
  return (
    useLiveQuery(
      async (): Promise<SettingsOverviewStats> => {
        const db = getWorkArchiveDb();
        const currentOrigin = getCurrentOrigin();
        const [
          activeWorkCount,
          deletedWorkCount,
          localOnlyWorkCount,
          syncQueueItems,
          timelineEntryCount,
          releaseRecordCount,
          lastJsonExportMeta,
        ] = await Promise.all([
          db.works.filter((work) => work.deletedAt === null).count(),
          db.works.filter((work) => work.deletedAt !== null).count(),
          db.works.where('syncStatus').equals('local-only').count(),
          db.syncQueue.toArray(),
          db.timelineEntries.count(),
          db.releaseRecords.count(),
          db.appMeta.get(LAST_JSON_EXPORT_AT_META_KEY),
        ]);

        const conflictQueueItemCount = syncQueueItems.filter(
          (item) => item.conflict !== null && item.conflict !== undefined,
        ).length;
        const failedQueueItemCount = syncQueueItems.filter(
          (item) =>
            Boolean(item.lastError) &&
            (item.conflict === null || item.conflict === undefined),
        ).length;
        const autoMergedQueueItemCount = syncQueueItems.filter(
          (item) => item.autoMerge?.status === 'requeued',
        ).length;

        return {
          activeWorkCount,
          archiveScopeKey: workArchiveDbManager.getCurrentScopeKey(),
          autoMergedQueueItemCount,
          conflictQueueItemCount,
          currentOrigin,
          databaseName: db.name,
          deletedWorkCount,
          failedQueueItemCount,
          isNonStandardLocalOrigin:
            isLocalhostOrigin(currentOrigin) &&
            currentOrigin !== STANDARD_LOCAL_WEB_ORIGIN,
          lastJsonExportAt: lastJsonExportMeta?.value ?? null,
          localOnlyWorkCount,
          releaseRecordCount,
          syncQueueItemCount: syncQueueItems.length,
          timelineEntryCount,
        };
      },
      [archiveScopeKey],
      EMPTY_STATS,
    ) ?? EMPTY_STATS
  );
}
