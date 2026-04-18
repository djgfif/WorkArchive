import { WorkSyncStatus } from '@prisma/client';

export const WORK_SYNC_STATUS_VALUES = [
  'local-only',
  'pending',
  'synced',
  'conflict',
] as const;

export type WorkSyncStatusValue = (typeof WORK_SYNC_STATUS_VALUES)[number];

const WORK_SYNC_STATUS_TO_API_VALUE: Record<WorkSyncStatus, WorkSyncStatusValue> =
  {
    [WorkSyncStatus.local_only]: 'local-only',
    [WorkSyncStatus.pending]: 'pending',
    [WorkSyncStatus.synced]: 'synced',
    [WorkSyncStatus.conflict]: 'conflict',
  };

export function toWorkSyncStatusValue(
  syncStatus: WorkSyncStatus,
): WorkSyncStatusValue {
  return WORK_SYNC_STATUS_TO_API_VALUE[syncStatus];
}
