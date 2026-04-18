export const WORK_SYNC_STATUS_VALUES = [
  'local-only',
  'pending',
  'synced',
  'conflict',
] as const;

export type WorkSyncStatusValue = (typeof WORK_SYNC_STATUS_VALUES)[number];
