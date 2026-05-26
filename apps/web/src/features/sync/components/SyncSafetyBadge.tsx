import { useMemo } from 'react';

import { AppLinkButton } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { getSyncSafetyBadgeState } from '../utils/sync-safety-state';

export function SyncSafetyBadge() {
  const { mode } = useAuthSession();
  const {
    conflictItems,
    failedItems,
    lastSuccessfulPullAt,
    pendingItems,
    staleStatusAt,
  } = useSyncDashboard();
  const requeuedCount = pendingItems.filter(
    (item) => item.state === 'requeued',
  ).length;
  const state = useMemo(() => {
    return getSyncSafetyBadgeState({
      conflictCount: conflictItems.length,
      failedCount: failedItems.length,
      lastSuccessfulPullAt,
      mode,
      pendingCount: pendingItems.length,
      requeuedCount,
      staleStatusAt,
    });
  }, [
    conflictItems.length,
    failedItems.length,
    lastSuccessfulPullAt,
    mode,
    pendingItems.length,
    requeuedCount,
    staleStatusAt,
  ]);

  return (
    <AppLinkButton
      aria-label={`동기화 상태: ${state.label}`}
      size="compact-xs"
      to={state.to}
      tone={state.tone}
    >
      {state.label}
    </AppLinkButton>
  );
}
