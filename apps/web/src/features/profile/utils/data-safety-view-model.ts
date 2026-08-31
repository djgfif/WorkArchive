import { appI18n, formatAppNumber } from '@app/i18n';
import type { AutomaticJsonBackupStatus } from '@features/archive';
import {
  getArchiveSafetyPresentation,
  type ArchiveSafetyState,
} from '@features/sync';

type DataSafetyTone = 'info' | 'muted' | 'warning';

export interface DataSafetyViewModel {
  actions: Array<{ label: string; tone: DataSafetyTone }>;
  accountBackupLabel: string;
  autoBackupLabel: string;
  description: string;
  lastJsonBackupLabel: string;
  lastPullLabel: string;
  lastPushLabel: string;
  localRecordLabel: string;
  storageLabel: string;
  title: string;
  tone: DataSafetyTone;
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

export function getDataSafetyViewModel({
  autoBackupStatus,
  mode,
  safetyState,
}: {
  autoBackupStatus: AutomaticJsonBackupStatus;
  mode: 'authenticated' | 'guest';
  safetyState: ArchiveSafetyState;
}): DataSafetyViewModel {
  const presentation = getArchiveSafetyPresentation(safetyState);
  const actions: DataSafetyViewModel['actions'] = [];

  if (safetyState.sync.status === 'needs-review') {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionReviewAccountBackup'),
      tone: 'warning',
    });
  }

  if (
    safetyState.jsonBackup.status === 'missing' ||
    safetyState.jsonBackup.status === 'stale'
  ) {
    actions.push({
      label: appI18n.t('settings.dataSafety.actionCreateJsonBackup'),
      tone: 'warning',
    });
  }

  if (safetyState.storage.status === 'best-effort') {
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

  return {
    accountBackupLabel: presentation.syncLabel,
    actions,
    autoBackupLabel: getAutoBackupLabel(autoBackupStatus),
    description: presentation.description,
    lastJsonBackupLabel: presentation.jsonBackupLabel,
    lastPullLabel: presentation.lastPullLabel,
    lastPushLabel: presentation.lastPushLabel,
    localRecordLabel: appI18n.t('settings.dataSafety.localRecords', {
      count: formatAppNumber(safetyState.activeRecordCount),
    }),
    storageLabel: presentation.storageLabel,
    title: presentation.title,
    tone: presentation.tone,
  };
}
