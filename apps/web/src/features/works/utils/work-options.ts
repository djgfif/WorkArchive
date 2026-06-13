import {
  type SerialStatus,
  type WorkStatus,
  type WorkSyncStatus,
  type WorkType,
  SERIAL_STATUSES,
  WORK_TYPES,
} from '@work-archive/shared-types';

import type { WorksSortOption } from './query-works';
import { appI18n, formatAppDate, formatAppDateTime } from '@app/i18n';

const workTypeLabels: Record<WorkType, string> = {
  novel: appI18n.t('works.type.novel'),
  anime: appI18n.t('works.type.anime'),
  manga: appI18n.t('works.type.manga'),
  light_novel: appI18n.t('works.type.light_novel'),
  web_novel: appI18n.t('works.type.web_novel'),
  webtoon: appI18n.t('works.type.webtoon'),
  movie: appI18n.t('works.type.movie'),
  drama: appI18n.t('works.type.drama'),
  other: appI18n.t('works.type.other'),
};

const workStatusLabels: Record<WorkStatus, string> = {
  planned: appI18n.t('works.status.planned'),
  in_progress: appI18n.t('works.status.in_progress'),
  on_hold: appI18n.t('works.status.on_hold'),
  completed: appI18n.t('works.status.completed'),
  dropped: appI18n.t('works.status.dropped'),
};

export const visibleWorkStatuses = [
  'planned',
  'in_progress',
  'on_hold',
  'completed',
  'dropped',
] as const satisfies readonly WorkStatus[];

const workSyncStatusLabels: Record<WorkSyncStatus, string> = {
  'local-only': appI18n.t('works.syncStatus.localOnly'),
  pending: appI18n.t('works.syncStatus.pending'),
  synced: appI18n.t('works.syncStatus.synced'),
  conflict: appI18n.t('works.syncStatus.conflict'),
};

export const workTypeOptions = WORK_TYPES.map((value) => ({
  value,
  label: workTypeLabels[value],
}));

export const workStatusOptions = visibleWorkStatuses.map((value) => ({
  value,
  label: workStatusLabels[value],
}));

export const visibleWorkStatusOptions = visibleWorkStatuses.map((value) => ({
  value,
  label: workStatusLabels[value],
}));

export const workSortOptions: Array<{ value: WorksSortOption; label: string }> =
  [
    { value: 'updatedAt', label: appI18n.t('works.sort.updatedAt') },
    { value: 'createdAt', label: appI18n.t('works.sort.createdAt') },
    { value: 'lastConsumedAt', label: appI18n.t('works.sort.lastConsumedAt') },
    { value: 'startedAt', label: appI18n.t('works.sort.startedAt') },
    { value: 'completedAt', label: appI18n.t('works.sort.completedAt') },
    { value: 'title', label: appI18n.t('works.sort.title') },
    { value: 'rating', label: appI18n.t('works.sort.rating') },
  ];

export function getWorkTypeLabel(value: WorkType) {
  return workTypeLabels[value];
}

export function getWorkStatusLabel(value: WorkStatus) {
  return workStatusLabels[value];
}

const serialStatusLabels: Record<SerialStatus, string> = {
  ongoing: appI18n.t('works.serialStatus.ongoing'),
  completed: appI18n.t('works.serialStatus.completed'),
  hiatus: appI18n.t('works.serialStatus.hiatus'),
};

export const serialStatusOptions = SERIAL_STATUSES.map((value) => ({
  value,
  label: serialStatusLabels[value],
}));

export function getSerialStatusLabel(value: SerialStatus) {
  return serialStatusLabels[value];
}

export function getWorkSyncStatusLabel(value: WorkSyncStatus) {
  return workSyncStatusLabels[value];
}

export function formatWorkDateTime(value: string) {
  return formatAppDateTime(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatWorkUpdatedAt(value: string) {
  return formatWorkDateTime(value);
}

export function formatWorkDate(value?: string | null) {
  if (!value) {
    return appI18n.t('works.dateMissing');
  }

  return formatAppDate(value, {
    dateStyle: 'medium',
  });
}
