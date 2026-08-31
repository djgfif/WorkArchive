import {
  canUseProgressUnitForWorkType,
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

export interface HomeQuickProgressAction {
  nextCurrent: number;
  progressTotal: number | null;
  progressUnit: ProgressUnit;
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

export function getHomeQuickProgressAction(
  work: WorkRecord,
): HomeQuickProgressAction | null {
  if (work.status !== 'in_progress') {
    return null;
  }

  const progressUnit =
    work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);

  if (
    progressUnit === null ||
    !canUseProgressUnitForWorkType(work.type, progressUnit)
  ) {
    return null;
  }

  const current = work.progressCurrent ?? 0;
  const total = work.progressTotal ?? null;

  if (
    !isNonNegativeInteger(current) ||
    (total !== null && !isNonNegativeInteger(total)) ||
    (total !== null && current >= total)
  ) {
    return null;
  }

  return {
    nextCurrent: current + 1,
    progressTotal: total,
    progressUnit,
  };
}
