import { appI18n, formatAppDateTime, formatAppNumber } from '@app/i18n';
import type { StoragePersistenceState } from '@shared/runtime/persistent-storage';
import { JSON_BACKUP_STALE_DAYS } from '@shared/constants/archive-metadata';

export {
  JSON_BACKUP_STALE_DAYS as ARCHIVE_JSON_BACKUP_STALE_DAYS,
} from '@shared/constants/archive-metadata';
const DAY_MS = 86_400_000;

type ArchiveSafetyLevel = 'action' | 'empty' | 'pending' | 'steady';
type ArchiveSafetyTone = 'muted' | 'info' | 'warning';

export interface ArchiveSafetyState {
  activeRecordCount: number;
  jsonBackup: {
    daysSince: number | null;
    lastSuccessfulAt: string | null;
    staleAfterDays: number;
    status: 'current' | 'empty' | 'missing' | 'stale';
  };
  level: ArchiveSafetyLevel;
  storage: {
    status: 'best-effort' | 'persistent' | 'unsupported';
  };
  sync: {
    conflictCount: number;
    failedCount: number;
    lastSuccessfulPullAt: string | null;
    lastSuccessfulPushAt: string | null;
    pendingCount: number;
    requeuedCount: number;
    staleStatusAt: string | null;
    status: 'guest' | 'idle' | 'needs-review' | 'pending' | 'stale';
  };
}

export interface ArchiveSafetyPresentation {
  badge: {
    label: string;
    to: string;
    tone: 'quiet' | 'secondary';
  };
  description: string;
  jsonBackupLabel: string;
  lastPullLabel: string;
  lastPushLabel: string;
  storageLabel: string;
  syncLabel: string;
  title: string;
  tone: ArchiveSafetyTone;
}

interface ArchiveSafetyInput {
  activeRecordCount: number;
  conflictCount: number;
  failedCount: number;
  lastJsonBackupAt: string | null;
  lastSuccessfulPullAt: string | null;
  lastSuccessfulPushAt: string | null;
  mode: 'authenticated' | 'guest';
  now?: Date;
  pendingCount: number;
  requeuedCount: number;
  staleStatusAt: string | null;
  storageState: StoragePersistenceState;
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: string | null) {
  const date = parseDate(value);

  if (!date) {
    return appI18n.t('sync.archiveSafety.none');
  }

  return formatAppDateTime(date, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getJsonBackupState(
  activeRecordCount: number,
  lastJsonBackupAt: string | null,
  now: Date,
): ArchiveSafetyState['jsonBackup'] {
  const backupDate = parseDate(lastJsonBackupAt);
  const daysSince = backupDate
    ? Math.max(0, Math.floor((now.getTime() - backupDate.getTime()) / DAY_MS))
    : null;

  if (!backupDate) {
    return {
      daysSince,
      lastSuccessfulAt: null,
      staleAfterDays: JSON_BACKUP_STALE_DAYS,
      status: activeRecordCount > 0 ? 'missing' : 'empty',
    };
  }

  return {
    daysSince,
    lastSuccessfulAt: backupDate.toISOString(),
    staleAfterDays: JSON_BACKUP_STALE_DAYS,
    status:
      daysSince !== null && daysSince >= JSON_BACKUP_STALE_DAYS
        ? 'stale'
        : 'current',
  };
}

export function getArchiveSafetyState({
  activeRecordCount,
  conflictCount,
  failedCount,
  lastJsonBackupAt,
  lastSuccessfulPullAt,
  lastSuccessfulPushAt,
  mode,
  now = new Date(),
  pendingCount,
  requeuedCount,
  staleStatusAt,
  storageState,
}: ArchiveSafetyInput): ArchiveSafetyState {
  const jsonBackup = getJsonBackupState(
    activeRecordCount,
    lastJsonBackupAt,
    now,
  );
  const storageStatus = !storageState.supported
    ? 'unsupported'
    : storageState.persisted
      ? 'persistent'
      : 'best-effort';
  const syncStatus =
    mode === 'guest'
      ? 'guest'
      : conflictCount > 0 || failedCount > 0
        ? 'needs-review'
        : staleStatusAt
          ? 'stale'
          : pendingCount > 0 || requeuedCount > 0
            ? 'pending'
            : 'idle';
  const needsAction =
    syncStatus === 'needs-review' ||
    jsonBackup.status === 'missing' ||
    jsonBackup.status === 'stale' ||
    (activeRecordCount > 0 && storageStatus === 'best-effort');
  const level: ArchiveSafetyLevel = needsAction
    ? 'action'
    : syncStatus === 'pending' || syncStatus === 'stale'
      ? 'pending'
      : activeRecordCount === 0
        ? 'empty'
        : 'steady';

  return {
    activeRecordCount,
    jsonBackup,
    level,
    storage: {
      status: storageStatus,
    },
    sync: {
      conflictCount,
      failedCount,
      lastSuccessfulPullAt,
      lastSuccessfulPushAt,
      pendingCount,
      requeuedCount,
      staleStatusAt,
      status: syncStatus,
    },
  };
}

function getJsonBackupLabel(state: ArchiveSafetyState) {
  switch (state.jsonBackup.status) {
    case 'missing':
      return appI18n.t('sync.archiveSafety.jsonBackupMissing');
    case 'stale':
      return appI18n.t('sync.archiveSafety.jsonBackupStale', {
        count: formatAppNumber(state.jsonBackup.daysSince ?? 0),
      });
    case 'current':
      return appI18n.t('sync.archiveSafety.jsonBackupCurrent', {
        date: formatDateTime(state.jsonBackup.lastSuccessfulAt),
      });
    default:
      return appI18n.t('sync.archiveSafety.jsonBackupEmpty');
  }
}

function getSyncLabel(state: ArchiveSafetyState) {
  switch (state.sync.status) {
    case 'guest':
      return appI18n.t('sync.archiveSafety.syncGuest');
    case 'needs-review':
      return appI18n.t('sync.archiveSafety.syncNeedsReview', {
        count: formatAppNumber(
          state.sync.conflictCount + state.sync.failedCount,
        ),
      });
    case 'pending':
      return appI18n.t('sync.archiveSafety.syncPending', {
        count: formatAppNumber(state.sync.pendingCount),
      });
    case 'stale':
      return appI18n.t('sync.archiveSafety.syncStale');
    default:
      return state.sync.lastSuccessfulPushAt
        ? appI18n.t('sync.archiveSafety.syncLastPush', {
            date: formatDateTime(state.sync.lastSuccessfulPushAt),
          })
        : appI18n.t('sync.archiveSafety.syncNoPush');
  }
}

export function getArchiveSafetyPresentation(
  state: ArchiveSafetyState,
): ArchiveSafetyPresentation {
  const tone: ArchiveSafetyTone =
    state.level === 'action'
      ? 'warning'
      : state.level === 'pending'
        ? 'info'
        : 'muted';
  const title = appI18n.t(`sync.archiveSafety.summary.${state.level}.title`);
  const description = appI18n.t(
    `sync.archiveSafety.summary.${state.level}.description`,
  );
  let badgeLabel: string;

  if (state.sync.status === 'guest') {
    badgeLabel = appI18n.t('sync.badgeGuest');
  } else if (state.sync.status === 'needs-review') {
    badgeLabel = appI18n.t('sync.badgeConflictReview', {
      count: formatAppNumber(
        state.sync.conflictCount + state.sync.failedCount,
      ),
    });
  } else if (state.sync.status === 'stale') {
    badgeLabel = appI18n.t('sync.badgeStale');
  } else if (state.sync.requeuedCount > 0) {
    badgeLabel = appI18n.t('sync.badgeRequeued', {
      count: formatAppNumber(state.sync.requeuedCount),
    });
  } else if (state.sync.pendingCount > 0) {
    badgeLabel = appI18n.t('sync.badgePending', {
      count: formatAppNumber(state.sync.pendingCount),
    });
  } else if (state.sync.lastSuccessfulPushAt) {
    badgeLabel = appI18n.t('sync.archiveSafety.badgeLastPush', {
      date: formatDateTime(state.sync.lastSuccessfulPushAt),
    });
  } else {
    badgeLabel = appI18n.t('sync.archiveSafety.badgeNoPush');
  }

  return {
    badge: {
      label: badgeLabel,
      to:
        state.sync.status === 'needs-review'
          ? '/account/settings#account-backup-recovery'
          : '/account/settings#data-backup',
      tone:
        state.sync.status === 'needs-review' ||
        state.sync.status === 'pending' ||
        state.sync.status === 'stale'
          ? 'secondary'
          : 'quiet',
    },
    description,
    jsonBackupLabel: getJsonBackupLabel(state),
    lastPullLabel: formatDateTime(state.sync.lastSuccessfulPullAt),
    lastPushLabel: formatDateTime(state.sync.lastSuccessfulPushAt),
    storageLabel:
      state.storage.status === 'persistent'
        ? appI18n.t('sync.archiveSafety.storagePersistent')
        : state.storage.status === 'best-effort'
          ? appI18n.t('sync.archiveSafety.storageBestEffort')
          : appI18n.t('sync.archiveSafety.storageUnsupported'),
    syncLabel: getSyncLabel(state),
    title,
    tone,
  };
}

export function getSyncSafetyBadgeState(state: ArchiveSafetyState) {
  return getArchiveSafetyPresentation(state).badge;
}
