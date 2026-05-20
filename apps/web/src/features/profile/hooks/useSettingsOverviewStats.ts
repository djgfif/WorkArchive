import { useLiveQuery } from 'dexie-react-hooks';

import { getWorkArchiveDb } from '../../works/db/work-archive.db';

export const LAST_JSON_EXPORT_AT_META_KEY = 'archive.lastJsonExportAt';

export interface SettingsOverviewStats {
  activeWorkCount: number;
  conflictQueueItemCount: number;
  deletedWorkCount: number;
  failedQueueItemCount: number;
  lastJsonExportAt: string | null;
  releaseRecordCount: number;
  syncQueueItemCount: number;
  timelineEntryCount: number;
}

const EMPTY_STATS: SettingsOverviewStats = {
  activeWorkCount: 0,
  conflictQueueItemCount: 0,
  deletedWorkCount: 0,
  failedQueueItemCount: 0,
  lastJsonExportAt: null,
  releaseRecordCount: 0,
  syncQueueItemCount: 0,
  timelineEntryCount: 0,
};

export function useSettingsOverviewStats(archiveScopeKey: string) {
  return (
    useLiveQuery(
      async (): Promise<SettingsOverviewStats> => {
        const db = getWorkArchiveDb();
        const [
          activeWorkCount,
          deletedWorkCount,
          syncQueueItems,
          timelineEntryCount,
          releaseRecordCount,
          lastJsonExportMeta,
        ] = await Promise.all([
          db.works.filter((work) => work.deletedAt === null).count(),
          db.works.filter((work) => work.deletedAt !== null).count(),
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

        return {
          activeWorkCount,
          conflictQueueItemCount,
          deletedWorkCount,
          failedQueueItemCount,
          lastJsonExportAt: lastJsonExportMeta?.value ?? null,
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
