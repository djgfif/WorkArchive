import { appI18n, formatAppNumber } from '@app/i18n';
import {
  JSON_BACKUP_MISSING_RECORD_THRESHOLD,
  JSON_BACKUP_STALE_DAYS,
} from '@shared/constants/archive-metadata';

export {
  JSON_BACKUP_STALE_DAYS,
  LAST_JSON_BACKUP_SUMMARY_META_KEY,
  LAST_JSON_EXPORT_AT_META_KEY,
} from '@shared/constants/archive-metadata';
export const JSON_BACKUP_REMINDER_WORK_THRESHOLD =
  JSON_BACKUP_MISSING_RECORD_THRESHOLD;

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
