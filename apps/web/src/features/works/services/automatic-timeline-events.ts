import type {
  TimelineEntryType,
  WorkRecord,
  WorkStatus,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import {
  getWorkContinueLabel,
  progressUnitLabels,
} from '../utils/work-list-row-state';
import { getWorkStatusLabel } from '../utils/work-options';

export interface AutomaticTimelineEntryDraft {
  note: string;
  occurredAt: string;
  type: TimelineEntryType;
}

const statusTimelineTypes: Partial<Record<WorkStatus, TimelineEntryType>> = {
  completed: 'completed',
  dropped: 'dropped',
  in_progress: 'started',
};

function normalizeProgressValue(value: number | null | undefined) {
  return value ?? null;
}

function normalizeProgressText(value: string | null | undefined) {
  return value?.trim() || null;
}

function hasProgressChanged(before: WorkRecord, after: WorkRecord) {
  return (
    normalizeProgressValue(before.progressCurrent) !==
      normalizeProgressValue(after.progressCurrent) ||
    normalizeProgressValue(before.progressTotal) !==
      normalizeProgressValue(after.progressTotal) ||
    (before.progressUnit ?? null) !== (after.progressUnit ?? null) ||
    normalizeProgressText(before.lastConsumedLabel) !==
      normalizeProgressText(after.lastConsumedLabel)
  );
}

function getProgressSnapshot(work: WorkRecord) {
  const continueLabel = getWorkContinueLabel(work);

  if (continueLabel) {
    return continueLabel;
  }

  const total = work.progressTotal ?? null;
  const unit = work.progressUnit ? progressUnitLabels[work.progressUnit] : '';

  if (total !== null) {
    return appI18n.t('works.detail.timelineAutomaticProgressTotal', {
      total,
      unit,
    });
  }

  if (work.progressUnit) {
    return appI18n.t('works.detail.timelineAutomaticProgressUnit', { unit });
  }

  return null;
}

export function buildAutomaticStatusTimelineEntry(
  before: WorkRecord,
  after: WorkRecord,
  occurredAt: string,
): AutomaticTimelineEntryDraft | null {
  if (before.status === after.status) {
    return null;
  }

  return {
    note: appI18n.t('works.detail.timelineAutomaticStatusChange', {
      next: getWorkStatusLabel(after.status),
      previous: getWorkStatusLabel(before.status),
    }),
    occurredAt,
    type: statusTimelineTypes[after.status] ?? 'note',
  };
}

export function buildAutomaticProgressTimelineEntry(
  before: WorkRecord,
  after: WorkRecord,
  occurredAt: string,
): AutomaticTimelineEntryDraft | null {
  if (!hasProgressChanged(before, after)) {
    return null;
  }

  const progress = getProgressSnapshot(after);

  return {
    note: progress
      ? appI18n.t('works.detail.timelineAutomaticProgressChange', { progress })
      : appI18n.t('works.detail.timelineAutomaticProgressCleared'),
    occurredAt,
    type: 'progress',
  };
}
