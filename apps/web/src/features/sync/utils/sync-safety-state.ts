import { appI18n, formatAppDateTime, formatAppNumber } from '@app/i18n';

function formatShortDateTime(value: string | null) {
  if (!value) {
    return '';
  }

  return formatAppDateTime(new Date(value), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSyncSafetyBadgeState({
  conflictCount,
  failedCount,
  lastSuccessfulPullAt,
  mode,
  pendingCount,
  requeuedCount = 0,
  staleStatusAt = null,
}: {
  conflictCount: number;
  failedCount: number;
  lastSuccessfulPullAt: string | null;
  mode: 'authenticated' | 'guest';
  pendingCount: number;
  requeuedCount?: number;
  staleStatusAt?: string | null;
}) {
  if (mode !== 'authenticated') {
    return {
      label: appI18n.t('sync.badgeGuest'),
      tone: 'quiet' as const,
      to: '/account',
    };
  }

  if (conflictCount > 0 || failedCount > 0) {
    return {
      label: appI18n.t('sync.badgeConflictReview', {
        count: formatAppNumber(conflictCount + failedCount),
      }),
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  if (staleStatusAt) {
    return {
      label: appI18n.t('sync.badgeStale'),
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  if (requeuedCount > 0) {
    return {
      label: appI18n.t('sync.badgeRequeued', {
        count: formatAppNumber(requeuedCount),
      }),
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  if (pendingCount > 0) {
    return {
      label: appI18n.t('sync.badgePending', {
        count: formatAppNumber(pendingCount),
      }),
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  return {
    label: lastSuccessfulPullAt
      ? appI18n.t('sync.badgeRecentAt', {
          date: formatShortDateTime(lastSuccessfulPullAt),
        })
      : appI18n.t('sync.badgeRecent'),
    tone: 'quiet' as const,
    to: '/account',
  };
}
