import type {
  SerialStatus,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import type {
  WorksIdentityPreset,
  WorksListQuery,
  WorksRatingPreset,
  WorksSmartFilter,
} from './query-works';
import {
  getSerialStatusLabel,
  getWorkStatusLabel,
  serialStatusOptions,
  visibleWorkStatusOptions,
  workSortOptions,
  workTypeOptions,
} from './work-options';
import { WORK_GENRES, isWorkGenre } from './work-genres';

export interface WorksToolbarFilterChip {
  label: string;
  onRemove: () => void;
}

export const ratingPresetOptions: Array<{
  label: string;
  value: WorksRatingPreset;
}> = [
  { label: '전체', value: 'all' },
  { label: '미평가', value: 'unrated' },
  { label: '4점 이상', value: 'gte4' },
  { label: '3점 이상', value: 'gte3' },
  { label: '2점 이하', value: 'lte2' },
];

export const smartFilterOptions: Array<{
  label: string;
  value: WorksSmartFilter;
}> = [
  { label: '전체', value: 'all' },
  { label: '즐겨찾기', value: 'favorites' },
  { label: '미평가', value: 'unrated' },
  { label: '정리 필요', value: 'needsCuration' },
];

export const identityPresetOptions: Array<{
  label: string;
  value: WorksIdentityPreset;
}> = [
  { label: '전체', value: 'all' },
  { label: '직접 등록', value: 'manual' },
  { label: '가져오기', value: 'imported' },
  { label: '카탈로그 연결', value: 'catalogLinked' },
];

export const serialStatusFilterOptions: Array<{
  label: string;
  value: SerialStatus | 'all';
}> = [{ label: '전체', value: 'all' }, ...serialStatusOptions];

function getRatingPresetLabel(value: WorksRatingPreset | undefined) {
  return (
    ratingPresetOptions.find((option) => option.value === value)?.label ??
    '전체'
  );
}

function getSmartFilterLabel(value: WorksSmartFilter | undefined) {
  return (
    smartFilterOptions.find((option) => option.value === value)?.label ??
    '전체'
  );
}

function getIdentityPresetLabel(value: WorksIdentityPreset | undefined) {
  return (
    identityPresetOptions.find((option) => option.value === value)?.label ??
    '전체'
  );
}

export function buildGenreFilterOptions(genreSuggestions: string[]) {
  return [
    { label: '전체', value: '' },
    ...Array.from(
      new Set([...genreSuggestions.filter(isWorkGenre), ...WORK_GENRES]),
    ).map((genre) => ({
      label: genre,
      value: genre,
    })),
  ];
}

export function buildStatusFilterOptions({
  statusCounts,
  totalActiveCount,
}: {
  statusCounts: Record<WorkStatus, number>;
  totalActiveCount: number;
}) {
  return [
    { label: '전체', value: 'all' as const, count: totalActiveCount },
    ...visibleWorkStatusOptions.map((option) => ({
      count: statusCounts[option.value],
      label: option.label,
      value: option.value,
    })),
  ];
}

export function buildMediaTypeOptions({
  activeValue,
  totalCount,
  typeCounts,
}: {
  activeValue?: WorksListQuery['type'];
  totalCount: number;
  typeCounts: Record<WorkType, number>;
}) {
  return [
    { count: totalCount, label: '전체', value: 'all' as const },
    ...workTypeOptions
      .map((option) => ({
        count: typeCounts[option.value],
        label: option.label,
        value: option.value,
      }))
      // 기록이 없는 유형은 숨긴다. 단, 현재 선택된 유형은 해제할 수 있도록 남긴다.
      .filter((option) => option.count > 0 || option.value === activeValue),
  ];
}

export function buildActiveFilterChips({
  defaultSortDirection,
  onQueryChange,
  query,
  sortDirection,
}: {
  defaultSortDirection: NonNullable<WorksListQuery['sortDirection']>;
  onQueryChange: (query: WorksListQuery) => void;
  query: WorksListQuery;
  sortDirection: NonNullable<WorksListQuery['sortDirection']>;
}): WorksToolbarFilterChip[] {
  return [
    ...(query.searchTerm.trim()
      ? [
          {
            label: `"${query.searchTerm.trim()}"`,
            onRemove: () => onQueryChange({ ...query, searchTerm: '' }),
          },
        ]
      : []),
    ...(query.series?.trim()
      ? [
          {
            label: `시리즈: ${query.series.trim()}`,
            onRemove: () => onQueryChange({ ...query, series: '' }),
          },
        ]
      : []),
    ...(query.contributor?.trim()
      ? [
          {
            label: `제작진: ${query.contributor.trim()}`,
            onRemove: () => onQueryChange({ ...query, contributor: '' }),
          },
        ]
      : []),
    ...(query.personContributor?.trim()
      ? [
          {
            label: `작가/제작진: ${query.personContributor.trim()}`,
            onRemove: () =>
              onQueryChange({ ...query, personContributor: '' }),
          },
        ]
      : []),
    ...(query.organizationContributor?.trim()
      ? [
          {
            label: `회사/플랫폼: ${query.organizationContributor.trim()}`,
            onRemove: () =>
              onQueryChange({ ...query, organizationContributor: '' }),
          },
        ]
      : []),
    ...(query.genre?.trim()
      ? [
          {
            label: `장르: ${query.genre.trim()}`,
            onRemove: () => onQueryChange({ ...query, genre: '' }),
          },
        ]
      : []),
    ...(query.tag?.trim()
      ? [
          {
            label: `#${query.tag.trim()}`,
            onRemove: () => onQueryChange({ ...query, tag: '' }),
          },
        ]
      : []),
    ...(query.status !== 'all'
      ? [
          {
            label: getWorkStatusLabel(query.status),
            onRemove: () => onQueryChange({ ...query, status: 'all' }),
          },
        ]
      : []),
    ...(query.serialStatus && query.serialStatus !== 'all'
      ? [
          {
            label: `연재: ${getSerialStatusLabel(query.serialStatus)}`,
            onRemove: () => onQueryChange({ ...query, serialStatus: 'all' }),
          },
        ]
      : []),
    ...(query.rating !== null
      ? [
          {
            label: `★ ${query.rating.toFixed(1)}`,
            onRemove: () => onQueryChange({ ...query, rating: null }),
          },
        ]
      : []),
    ...(query.rating === null && (query.ratingPreset ?? 'all') !== 'all'
      ? [
          {
            label: `별점: ${getRatingPresetLabel(query.ratingPreset)}`,
            onRemove: () =>
              onQueryChange({ ...query, ratingPreset: 'all' }),
          },
        ]
      : []),
    ...((query.smartFilter ?? 'all') !== 'all'
      ? [
          {
            label: getSmartFilterLabel(query.smartFilter),
            onRemove: () => onQueryChange({ ...query, smartFilter: 'all' }),
          },
        ]
      : []),
    ...((query.identityPreset ?? 'all') !== 'all'
      ? [
          {
            label: `등록: ${getIdentityPresetLabel(query.identityPreset)}`,
            onRemove: () =>
              onQueryChange({ ...query, identityPreset: 'all' }),
          },
        ]
      : []),
    ...(query.type !== 'all'
      ? [
          {
            label:
              workTypeOptions.find((option) => option.value === query.type)
                ?.label ?? query.type,
            onRemove: () => onQueryChange({ ...query, type: 'all' }),
          },
        ]
      : []),
    ...(query.sortBy !== 'updatedAt'
      ? [
          {
            label: `정렬: ${
              workSortOptions.find((option) => option.value === query.sortBy)
                ?.label ?? query.sortBy
            }`,
            onRemove: () => onQueryChange({ ...query, sortBy: 'updatedAt' }),
          },
        ]
      : []),
    ...(sortDirection !== defaultSortDirection
      ? [
          {
            label: sortDirection === 'asc' ? '오름차순' : '내림차순',
            onRemove: () =>
              onQueryChange({ ...query, sortDirection: defaultSortDirection }),
          },
        ]
      : []),
  ];
}
