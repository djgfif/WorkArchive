import type { SerialStatus } from '@work-archive/shared-types';

import { AppBadge } from '@shared/components/AppPrimitives';
import { getSerialStatusLabel } from '../utils/work-options';

const toneBySerialStatus = {
  ongoing: 'info',
  completed: 'accent',
  hiatus: 'warning',
} as const;

/**
 * 작품의 연재(공급) 상태 뱃지 — 완결/연재 중/휴재. 리디·시리즈의 "완결" 뱃지 패턴.
 * 미정(null)일 때는 아무것도 그리지 않는다.
 */
export function SerialStatusBadge({
  serialStatus,
}: {
  serialStatus?: SerialStatus | null | undefined;
}) {
  if (!serialStatus) {
    return null;
  }

  return (
    <AppBadge tone={toneBySerialStatus[serialStatus]}>
      {getSerialStatusLabel(serialStatus)}
    </AppBadge>
  );
}
