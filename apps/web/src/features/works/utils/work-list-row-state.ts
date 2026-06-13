import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { getWorkStatusLabel } from './work-options';

export const workListRowRatingOptions = Array.from(
  { length: 10 },
  (_, index) => {
    const value = (index + 1) * 0.5;

    return { label: `★ ${value.toFixed(1)}`, value };
  },
);

export const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: appI18n.t('works.record.progressControl.unitChapter'),
  episode: appI18n.t('works.record.progressControl.unitEpisode'),
  volume: appI18n.t('works.record.progressControl.unitVolume'),
};

export const progressCurrentLabels: Record<ProgressUnit, string> = {
  chapter: appI18n.t('works.record.progressControl.currentChapter'),
  episode: appI18n.t('works.record.progressControl.currentEpisode'),
  volume: appI18n.t('works.record.progressControl.currentVolume'),
};

export const progressTotalLabels: Record<ProgressUnit, string> = {
  chapter: appI18n.t('works.record.progressControl.totalChapter'),
  episode: appI18n.t('works.record.progressControl.totalEpisode'),
  volume: appI18n.t('works.record.progressControl.totalVolume'),
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
  if (current !== null) {
    return appI18n.t('works.list.progressUntil', { current });
  }

  return null;
}

export function getWorkListProgressUnit(work: WorkRecord) {
  return work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);
}

/**
 * "이어보기" 칩에 쓰는 짧은 진행 지점 라벨 (유닛 포함).
 * 예) "127/200화", "12권", 또는 사용자가 적은 마지막 위치.
 */
export function getWorkContinueLabel(work: WorkRecord): string | null {
  const unit = getWorkListProgressUnit(work);
  const unitLabel = unit ? progressUnitLabels[unit] : '';
  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current !== null && total !== null) {
    return `${current}/${total}${unitLabel}`;
  }

  if (current !== null) {
    return `${current}${unitLabel}`;
  }

  if (work.lastConsumedLabel) {
    return work.lastConsumedLabel;
  }

  return null;
}
