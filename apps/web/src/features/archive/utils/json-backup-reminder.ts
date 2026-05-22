export const LAST_JSON_EXPORT_AT_META_KEY = 'archive.lastJsonExportAt';
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
      description: `작품이 ${activeWorkCount}개 쌓였습니다. 브라우저 로컬 데이터 보호를 위해 JSON 백업 파일을 만들어 두세요.`,
      lastJsonExportAt,
      reason: 'missing',
      shouldShow: true,
      title: '첫 JSON 백업을 권장합니다',
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
      description: `마지막 JSON 백업 후 ${daysSinceLastBackup}일이 지났습니다. 최근 기록을 새 파일로 보관하세요.`,
      lastJsonExportAt,
      reason: 'stale',
      shouldShow: true,
      title: 'JSON 백업을 갱신할 때입니다',
    };
  }

  return {
    activeWorkCount,
    daysSinceLastBackup,
    description: backupDate
      ? '최근 JSON 백업 상태가 양호합니다.'
      : '작품이 더 쌓이면 JSON 백업을 안내합니다.',
    lastJsonExportAt,
    reason: 'none',
    shouldShow: false,
    title: 'JSON 백업 상태 양호',
  };
}
