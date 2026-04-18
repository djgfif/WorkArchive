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
  novel: '소설',
  anime: '애니',
  manga: '만화',
  light_novel: '라이트노벨',
  web_novel: '웹소설',
  webtoon: '웹툰',
  movie: '영화',
  drama: '드라마',
  other: '기타',
};

const workStatusLabels: Record<WorkStatus, string> = {
  planned: '예정',
  in_progress: '진행 중',
  completed: '완료',
  paused: '보류',
  dropped: '중단',
};

const workTierLabels: Record<WorkTier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
};

const workSyncStatusLabels: Record<WorkSyncStatus, string> = {
  'local-only': '기기 저장',
  pending: '동기화 대기',
  synced: '동기화됨',
  conflict: '충돌',
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
  { value: 'updatedAt', label: '최근 수정순' },
  { value: 'title', label: '제목순' },
  { value: 'rating', label: '별점순' },
];

export function getWorkTypeLabel(value: WorkType) {
  return workTypeLabels[value];
}

export function getWorkStatusLabel(value: WorkStatus) {
  return workStatusLabels[value];
}

export function getWorkTierLabel(value: WorkTier | null) {
  return value ? workTierLabels[value] : '미지정';
}

export function getWorkSyncStatusLabel(value: WorkSyncStatus) {
  return workSyncStatusLabels[value];
}

export function formatWorkDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatWorkUpdatedAt(value: string) {
  return formatWorkDateTime(value);
}
