import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

import { getWorkStatusLabel } from './work-options';

export const workListRowRatingOptions = Array.from(
  { length: 10 },
  (_, index) => {
    const value = (index + 1) * 0.5;

    return { label: `★ ${value.toFixed(1)}`, value };
  },
);

export const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

export const progressCurrentLabels: Record<ProgressUnit, string> = {
  chapter: '읽은 화',
  episode: '본 회차',
  volume: '읽은 권',
};

export const progressTotalLabels: Record<ProgressUnit, string> = {
  chapter: '전체 화',
  episode: '전체 회차',
  volume: '전체 권',
};

export function getWorkListMetaLine(work: WorkRecord) {
  const rating = work.rating !== null ? `★ ${work.rating.toFixed(1)}` : null;
  const status = getWorkStatusLabel(work.status);

  return [rating, status].filter(Boolean).join(' · ');
}

export function coerceNumberInputValue(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

export function getProgressPercent(work: WorkRecord) {
  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current === null || total === null || total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((current / total) * 100));
}

export function getProgressLabel(work: WorkRecord) {
  if (work.lastConsumedLabel) return work.lastConsumedLabel;

  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current !== null && total !== null) return `${current}/${total}`;
  if (current !== null) return `${current}까지`;

  return null;
}

export function getWorkListProgressUnit(work: WorkRecord) {
  return work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);
}
