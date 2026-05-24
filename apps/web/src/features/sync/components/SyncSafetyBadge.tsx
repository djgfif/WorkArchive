import { useMemo } from 'react';

import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../../auth';
import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { getSyncSafetyBadgeState } from '../utils/sync-safety-state';

export function SyncSafetyBadge() {
  const { mode } = useAuthSession();
  const { conflictItems, failedItems, lastSuccessfulPullAt, pendingItems } =
    useSyncDashboard();
  const state = useMemo(() => {
    return getSyncSafetyBadgeState({
      conflictCount: conflictItems.length,
      failedCount: failedItems.length,
      lastSuccessfulPullAt,
      mode,
      pendingCount: pendingItems.length,
    });
  }, [
    conflictItems.length,
    failedItems.length,
    lastSuccessfulPullAt,
    mode,
    pendingItems.length,
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
