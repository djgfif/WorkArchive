import { appI18n, formatAppDateTime, formatAppNumber } from '@app/i18n';
import type { AutomaticJsonBackupStatus } from '@features/archive';
import type { StoragePersistenceState } from '@shared/runtime/persistent-storage';
import type { SettingsOverviewStats } from '../hooks/useSettingsOverviewStats';

type DataSafetyTone = 'info' | 'muted' | 'success' | 'warning';

export interface DataSafetySyncInput {
  conflictCount: number;
  failedCount: number;
  lastSuccessfulPullAt: string | null;
  pendingCount: number;
  requeuedCount: number;
  staleStatusAt: string | null;
}

export interface DataSafetyViewModel {
  actions: Array<{ label: string; tone: DataSafetyTone }>;
  accountBackupLabel: string;
  autoBackupLabel: string;
  description: string;
  lastJsonBackupLabel: string;
  localRecordLabel: string;
  storageLabel: string;
  title: string;
  tone: DataSafetyTone;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return appI18n.t('settings.dataSafety.noneYet');
  }

  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStorageLabel(storageState: StoragePersistenceState) {
  if (!storageState.supported) {
    return appI18n.t('settings.dataSafety.storageManual');
  }

  return storageState.persisted
    ? appI18n.t('settings.dataSafety.storageProtected')
    : appI18n.t('settings.dataSafety.storageActionNeeded');
}

function getAutoBackupLabel(autoBackupStatus: AutomaticJsonBackupStatus) {
  if (!autoBackupStatus.supported) {
    return appI18n.t('settings.dataSafety.autoBackupManual');
  }

  if (!autoBackupStatus.enabled) {
    return appI18n.t('settings.dataSafety.autoBackupOff');
  }

  return autoBackupStatus.hasSessionFolder
    ? appI18n.t('settings.dataSafety.autoBackupReady')
    : appI18n.t('settings.dataSafety.autoBackupNeedsFolder');
}

function getAccountBackupLabel(
  mode: 'authenticated' | 'guest',
  sync: DataSafetySyncInput,
) {
  if (mode !== 'authenticated') {
    return appI18n.t('settings.dataSafety.accountBackupOptional');
  }

  if (sync.conflictCount > 0 || sync.failedCount > 0) {
    return appI18n.t('settings.dataSafety.accountBackupNeedsReview', {
      count: formatAppNumber(sync.conflictCount + sync.failedCount),
    });
  }

  if (sync.staleStatusAt) {
    return appI18n.t('settings.dataSafety.accountBackupChecking');
  }

  if (sync.requeuedCount > 0) {
    return appI18n.t('settings.dataSafety.accountBackupRequeued', {
      count: formatAppNumber(sync.requeuedCount),
    });
  }

  if (sync.pendingCount > 0) {
    return appI18n.t('settings.dataSafety.accountBackupPending', {
      count: formatAppNumber(sync.pendingCount),
    });
  }

  return sync.lastSuccessfulPullAt
    ? appI18n.t('settings.dataSafety.accountBackupRecent', {
        date: formatDateTime(sync.lastSuccessfulPullAt),
      })
    : appI18n.t('settings.dataSafety.accountBackupReady');
}

export function getDataSafetyViewModel({
  autoBackupStatus,
  mode,
  overviewStats,
  storageState,
  sync,
}: {
  autoBackupStatus: AutomaticJsonBackupStatus;
  mode: 'authenticated' | 'guest';
  overviewStats: SettingsOverviewStats;
  storageState: StoragePersistenceState;
  sync: DataSafetySyncInput;
}): DataSafetyViewModel {
  const hasJsonBackup = Boolean(
    overviewStats.lastJsonBackupSummary?.exportedAt ??
    overviewStats.lastJsonExportAt,
  );
  const activeRecordCount = overviewStats.activeWorkCount;
  const actions: DataSafetyViewModel['actions'] = [];

  if (sync.conflictCount > 0 || sync.failedCount > 0) {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionReviewAccountBackup'),
      tone: 'warning',
    });
  }

  if (!hasJsonBackup && activeRecordCount > 0) {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionCreateJsonBackup'),
      tone: 'warning',
    });
  }

  if (storageState.supported && !storageState.persisted) {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionProtectStorage'),
      tone: 'info',
    });
  }

  if (autoBackupStatus.supported && !autoBackupStatus.enabled) {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionChooseAutoBackup'),
      tone: 'info',
    });
  }

  if (mode === 'guest') {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionAccountOptional'),
      tone: 'muted',
    });
  }

  const tone: DataSafetyTone =
    sync.conflictCount > 0 ||
    sync.failedCount > 0 ||
    (!hasJsonBackup && activeRecordCount > 0)
      ? 'warning'
      : sync.pendingCount > 0 || sync.requeuedCount > 0 || sync.staleStatusAt
        ? 'info'
        : hasJsonBackup ||
            storageState.persisted ||
            autoBackupStatus.lastSucceededAt
          ? 'success'
          : 'muted';

  const title =
    tone === 'warning'
      ? appI18n.t('settings.dataSafety.summaryNeedsActionTitle')
      : tone === 'info'
        ? appI18n.t('settings.dataSafety.summaryInProgressTitle')
        : tone === 'success'
          ? appI18n.t('settings.dataSafety.summarySafeTitle')
          : appI18n.t('settings.dataSafety.summaryReadyTitle');

  const description =
    tone === 'warning'
      ? appI18n.t('settings.dataSafety.summaryNeedsActionDescription')
      : tone === 'info'
        ? appI18n.t('settings.dataSafety.summaryInProgressDescription')
        : mode === 'authenticated'
          ? appI18n.t('settings.dataSafety.summaryAuthenticatedDescription')
          : appI18n.t('settings.dataSafety.summaryGuestDescription');

  return {
    accountBackupLabel: getAccountBackupLabel(mode, sync),
    actions,
    autoBackupLabel: getAutoBackupLabel(autoBackupStatus),
    description,
    lastJsonBackupLabel: formatDateTime(
      overviewStats.lastJsonBackupSummary?.exportedAt ??
        overviewStats.lastJsonExportAt,
    ),
    localRecordLabel: appI18n.t('settings.dataSafety.localRecords', {
      count: formatAppNumber(activeRecordCount),
    }),
    storageLabel: getStorageLabel(storageState),
    title,
    tone,
  };
}
