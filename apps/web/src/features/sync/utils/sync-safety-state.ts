function formatShortDateTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getSyncSafetyBadgeState({
  conflictCount,
  failedCount,
  lastSuccessfulPullAt,
  mode,
  pendingCount,
}: {
  conflictCount: number;
  failedCount: number;
  lastSuccessfulPullAt: string | null;
  mode: 'authenticated' | 'guest';
  pendingCount: number;
}) {
  if (mode !== 'authenticated') {
    return {
      label: '게스트 로컬 전용',
      tone: 'quiet' as const,
      to: '/account',
    };
  }

  if (conflictCount > 0 || failedCount > 0) {
    return {
      label: `충돌/실패 있음 ${conflictCount + failedCount}`,
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  if (pendingCount > 0) {
    return {
      label: `백업 대기 ${pendingCount}`,
      tone: 'secondary' as const,
      to: '/account',
    };
  }

  return {
    label: lastSuccessfulPullAt
      ? `최근 백업됨 ${formatShortDateTime(lastSuccessfulPullAt)}`
      : '최근 백업됨',
    tone: 'quiet' as const,
    to: '/account',
  };
}
