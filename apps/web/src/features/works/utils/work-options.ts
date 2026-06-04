import {
  type SerialStatus,
  type WorkStatus,
  type WorkSyncStatus,
  type WorkType,
  SERIAL_STATUSES,
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
  planned: '볼 예정',
  in_progress: '보는 중',
  on_hold: '보류',
  completed: '완료',
  dropped: '하차',
};

export const visibleWorkStatuses = [
  'planned',
  'in_progress',
  'on_hold',
  'completed',
  'dropped',
] as const satisfies readonly WorkStatus[];

const workSyncStatusLabels: Record<WorkSyncStatus, string> = {
  'local-only': '기기에 저장됨',
  pending: '자동 백업 중',
  synced: '백업됨',
  conflict: '확인 필요',
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

export const workSortOptions: Array<{ value: WorksSortOption; label: string }> = [
  { value: 'updatedAt', label: '최근 수정' },
  { value: 'createdAt', label: '추가일' },
  { value: 'lastConsumedAt', label: '마지막 감상' },
  { value: 'startedAt', label: '시작일' },
  { value: 'completedAt', label: '완료일' },
  { value: 'title', label: '제목순' },
  { value: 'rating', label: '별점순' },
];

export function getWorkTypeLabel(value: WorkType) {
  return workTypeLabels[value];
}

export function getWorkStatusLabel(value: WorkStatus) {
  return workStatusLabels[value];
}

const serialStatusLabels: Record<SerialStatus, string> = {
  ongoing: '연재 중',
  completed: '완결',
  hiatus: '휴재',
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
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatWorkUpdatedAt(value: string) {
  return formatWorkDateTime(value);
}

export function formatWorkDate(value?: string | null) {
  if (!value) {
    return '미기록';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}
