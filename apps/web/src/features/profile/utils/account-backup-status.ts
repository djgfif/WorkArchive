import type { SyncDashboardItem } from '@features/sync';

export type MergeGroupKey =
  | 'dates'
  | 'favorite'
  | 'metadata'
  | 'progress'
  | 'ratingReview'
  | 'status'
  | 'tags';

export type RecoveryGroupKey =
  | 'auth'
  | 'conflict'
  | 'network'
  | 'stale'
  | 'unknown'
  | 'validation';

export type RecoveryFilterKey = 'all' | RecoveryGroupKey;

export interface RecoveryGroupSummary {
  count: number;
  key: RecoveryGroupKey;
  tone: 'info' | 'muted' | 'warning';
}

interface MergeGroup {
  fields: string[];
  key: MergeGroupKey;
}

const RECOVERY_GROUP_ORDER: RecoveryGroupKey[] = [
  'conflict',
  'stale',
  'network',
  'auth',
  'validation',
  'unknown',
];

const WORK_MERGE_GROUPS: MergeGroup[] = [
  { key: 'status', fields: ['status'] },
  { key: 'ratingReview', fields: ['rating', 'shortReview', 'review'] },
  { key: 'favorite', fields: ['favorite'] },
  {
    key: 'progress',
    fields: [
      'progressCurrent',
      'progressTotal',
      'progressUnit',
      'lastConsumedLabel',
    ],
  },
  {
    key: 'dates',
    fields: ['startedAt', 'completedAt', 'droppedAt', 'lastConsumedAt'],
  },
  { key: 'tags', fields: ['genres', 'personalTags'] },
  { key: 'metadata', fields: ['description', 'thumbnailUrl'] },
];

const RELEASE_RECORD_MERGE_GROUPS: MergeGroup[] = [
  { key: 'status', fields: ['status'] },
  { key: 'ratingReview', fields: ['rating', 'shortReview', 'review'] },
  { key: 'favorite', fields: ['favorite'] },
];

const FAILURE_MARKERS = {
  network: ['network', 'fetch', 'offline', 'timeout', 'econn'],
  auth: ['401', '403', 'auth', 'jwt', 'session', 'token', 'unauthorized'],
  validation: ['400', 'badrequest', 'invalid', 'schema', 'validation'],
} as const;

export function getMergeGroups(
  item: Pick<SyncDashboardItem, 'entityType'>,
): MergeGroup[] {
  if (item.entityType === 'work') {
    return WORK_MERGE_GROUPS;
  }

  if (item.entityType === 'release_record') {
    return RELEASE_RECORD_MERGE_GROUPS;
  }

  return [];
}

export function getAccountBackupStatusTone({
  conflictCount,
  failedCount,
  pendingCount,
  staleStatusAt,
}: {
  conflictCount: number;
  failedCount: number;
  pendingCount: number;
  staleStatusAt: string | null;
}) {
  if (conflictCount > 0 || failedCount > 0 || staleStatusAt) {
    return 'warning' as const;
  }

  if (pendingCount > 0) {
    return 'info' as const;
  }

  return 'success' as const;
}

export function classifyFailedItem(
  item: Pick<SyncDashboardItem, 'conflictCode' | 'lastError'>,
): RecoveryGroupKey {
  const diagnostic =
    `${item.lastError ?? ''} ${item.conflictCode ?? ''}`.toLowerCase();

  for (const key of ['network', 'auth', 'validation'] as const) {
    if (FAILURE_MARKERS[key].some((marker) => diagnostic.includes(marker))) {
      return key;
    }
  }

  return 'unknown';
}

export function buildRecoveryGroups({
  conflictItems,
  failedItems,
  staleStatusAt,
}: {
  conflictItems: SyncDashboardItem[];
  failedItems: SyncDashboardItem[];
  staleStatusAt: string | null;
}): RecoveryGroupSummary[] {
  const counts = new Map<RecoveryGroupKey, number>();

  if (conflictItems.length > 0) {
    counts.set('conflict', conflictItems.length);
  }

  if (staleStatusAt) {
    counts.set('stale', 1);
  }

  for (const item of failedItems) {
    const key = classifyFailedItem(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return RECOVERY_GROUP_ORDER.flatMap((key) => {
    const count = counts.get(key) ?? 0;
    if (count === 0) {
      return [];
    }

    return [
      {
        count,
        key,
        tone:
          key === 'stale' ? 'info' : key === 'unknown' ? 'muted' : 'warning',
      } satisfies RecoveryGroupSummary,
    ];
  });
}

export function getItemRecoveryGroup(
  item: Pick<SyncDashboardItem, 'conflictCode' | 'lastError' | 'state'>,
): RecoveryGroupKey {
  return item.state === 'conflict' ? 'conflict' : classifyFailedItem(item);
}
