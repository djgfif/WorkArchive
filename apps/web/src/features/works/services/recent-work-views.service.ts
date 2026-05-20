import type { WorkRecord } from '@work-archive/shared-types';

const RECENT_WORK_VIEWS_PREFIX = 'work-archive:recent-work-views:';
const MAX_RECENT_WORK_VIEWS = 12;

export interface RecentWorkViewRecord {
  viewedAt: string;
  workId: string;
}

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getStorageKey(archiveScopeKey: string) {
  return `${RECENT_WORK_VIEWS_PREFIX}${archiveScopeKey}`;
}

function parseRecentWorkViews(rawValue: string | null): RecentWorkViewRecord[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is RecentWorkViewRecord =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof entry.workId === 'string' &&
              typeof entry.viewedAt === 'string',
          ),
      )
      .slice(0, MAX_RECENT_WORK_VIEWS);
  } catch {
    return [];
  }
}

function writeRecentWorkViews(
  archiveScopeKey: string,
  records: RecentWorkViewRecord[],
) {
  getStorage()?.setItem(
    getStorageKey(archiveScopeKey),
    JSON.stringify(records.slice(0, MAX_RECENT_WORK_VIEWS)),
  );
}

export const recentWorkViewsService = {
  getViews(archiveScopeKey: string) {
    return parseRecentWorkViews(getStorage()?.getItem(getStorageKey(archiveScopeKey)) ?? null);
  },

  recordView(archiveScopeKey: string, workId: string) {
    const nextRecord: RecentWorkViewRecord = {
      viewedAt: new Date().toISOString(),
      workId,
    };
    const previousRecords = this.getViews(archiveScopeKey);
    const nextRecords = [
      nextRecord,
      ...previousRecords.filter((record) => record.workId !== workId),
    ];

    writeRecentWorkViews(archiveScopeKey, nextRecords);
  },

  resolveWorks(archiveScopeKey: string, activeWorks: WorkRecord[]) {
    const workById = new Map(activeWorks.map((work) => [work.id, work]));

    return this.getViews(archiveScopeKey)
      .map((record) => workById.get(record.workId))
      .filter((work): work is WorkRecord => Boolean(work));
  },
};
