import {
  type WorkStatus,
  type WorkSyncStatus,
  type WorkTier,
  type WorkType,
  WORK_STATUSES,
  WORK_TIERS,
  WORK_TYPES,
} from '@work-archive/shared-types';

import type { WorksSortOption } from './query-works';

const workTypeLabels: Record<WorkType, string> = {
  novel: 'Novel',
  anime: 'Anime',
  manga: 'Manga',
  light_novel: 'Light novel',
  web_novel: 'Web novel',
  webtoon: 'Webtoon',
  movie: 'Movie',
  drama: 'Drama',
  other: 'Other',
};

const workStatusLabels: Record<WorkStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  paused: 'Paused',
  dropped: 'Dropped',
};

const workTierLabels: Record<WorkTier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
};

const workSyncStatusLabels: Record<WorkSyncStatus, string> = {
  'local-only': 'Local only',
  pending: 'Pending sync',
  synced: 'Synced',
  conflict: 'Conflict',
};

export const workTypeOptions = WORK_TYPES.map((value) => ({
  value,
  label: workTypeLabels[value],
}));

export const workStatusOptions = WORK_STATUSES.map((value) => ({
  value,
  label: workStatusLabels[value],
}));

export const workTierOptions = WORK_TIERS.map((value) => ({
  value,
  label: workTierLabels[value],
}));

export const workSortOptions: Array<{
  value: WorksSortOption;
  label: string;
}> = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title' },
  { value: 'rating', label: 'Rating' },
];

export function getWorkTypeLabel(value: WorkType) {
  return workTypeLabels[value];
}

export function getWorkStatusLabel(value: WorkStatus) {
  return workStatusLabels[value];
}

export function getWorkTierLabel(value: WorkTier | null) {
  return value ? workTierLabels[value] : 'Unranked';
}

export function getWorkSyncStatusLabel(value: WorkSyncStatus) {
  return workSyncStatusLabels[value];
}

export function formatWorkUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
