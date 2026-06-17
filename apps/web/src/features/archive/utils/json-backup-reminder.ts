import { appI18n, formatAppNumber } from '@app/i18n';

export const LAST_JSON_EXPORT_AT_META_KEY = 'archive.lastJsonExportAt';
export const LAST_JSON_BACKUP_SUMMARY_META_KEY =
  'archive.lastJsonBackupSummary';
export const JSON_BACKUP_REMINDER_WORK_THRESHOLD = 20;
export const JSON_BACKUP_STALE_DAYS = 30;

export type JsonBackupReminderReason = 'missing' | 'none' | 'stale';

export interface JsonBackupReminderStatus {
  activeWorkCount: number;
  daysSinceLastBackup: number | null;
  description: string;
  lastJsonExportAt: string | null;
  reason: JsonBackupReminderReason;
  shouldShow: boolean;
  title: string;
}

interface JsonBackupReminderInput {
  activeWorkCount: number;
  lastJsonExportAt: string | null;
  now?: Date;
}

function getDaysSince(date: Date, now: Date) {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function parseBackupDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function getJsonBackupReminderStatus({
  activeWorkCount,
  lastJsonExportAt,
  now = new Date(),
}: JsonBackupReminderInput): JsonBackupReminderStatus {
  const backupDate = parseBackupDate(lastJsonExportAt);
  const daysSinceLastBackup =
    backupDate === null ? null : getDaysSince(backupDate, now);
  const hasEnoughWorksForFirstBackup =
    activeWorkCount >= JSON_BACKUP_REMINDER_WORK_THRESHOLD;

  if (!backupDate && hasEnoughWorksForFirstBackup) {
    return {
      activeWorkCount,
      daysSinceLastBackup,
      description: appI18n.t('archive.backup.missingDescription', {
        count: formatAppNumber(activeWorkCount),
      }),
      lastJsonExportAt,
      reason: 'missing',
      shouldShow: true,
      title: appI18n.t('archive.backup.missingTitle'),
    };
  }

  if (
    backupDate &&
    daysSinceLastBackup !== null &&
    daysSinceLastBackup >= JSON_BACKUP_STALE_DAYS
  ) {
    return {
      activeWorkCount,
      daysSinceLastBackup,
      description: appI18n.t('archive.backup.staleDescription', {
        count: formatAppNumber(daysSinceLastBackup),
      }),
      lastJsonExportAt,
      reason: 'stale',
      shouldShow: true,
      title: appI18n.t('archive.backup.staleTitle'),
    };
  }

  return {
    activeWorkCount,
    daysSinceLastBackup,
    description: backupDate
      ? appI18n.t('archive.backup.healthyDescription')
      : appI18n.t('archive.backup.pendingDescription'),
    lastJsonExportAt,
    reason: 'none',
    shouldShow: false,
    title: appI18n.t('archive.backup.healthyTitle'),
  };
}
