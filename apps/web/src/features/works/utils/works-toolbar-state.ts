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
import { appI18n } from '@app/i18n';
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
  { label: appI18n.t('works.list.filterAll'), value: 'all' },
  { label: appI18n.t('works.list.filterUnrated'), value: 'unrated' },
  { label: appI18n.t('works.list.ratingGte4'), value: 'gte4' },
  { label: appI18n.t('works.list.ratingGte3'), value: 'gte3' },
  { label: appI18n.t('works.list.ratingLte2'), value: 'lte2' },
];

export const smartFilterOptions: Array<{
  label: string;
  value: WorksSmartFilter;
}> = [
  { label: appI18n.t('works.list.filterAll'), value: 'all' },
  { label: appI18n.t('works.list.smartFavorites'), value: 'favorites' },
  { label: appI18n.t('works.list.filterUnrated'), value: 'unrated' },
  {
    label: appI18n.t('works.list.smartNeedsCuration'),
    value: 'needsCuration',
  },
];

export const identityPresetOptions: Array<{
  label: string;
  value: WorksIdentityPreset;
}> = [
  { label: appI18n.t('works.list.filterAll'), value: 'all' },
  { label: appI18n.t('works.list.filterManual'), value: 'manual' },
  { label: appI18n.t('works.list.filterImported'), value: 'imported' },
  {
    label: appI18n.t('works.list.filterCatalogLinked'),
    value: 'catalogLinked',
  },
];

export const serialStatusFilterOptions: Array<{
  label: string;
  value: SerialStatus | 'all';
}> = [
  { label: appI18n.t('works.list.filterAll'), value: 'all' },
  ...serialStatusOptions,
];

function getRatingPresetLabel(value: WorksRatingPreset | undefined) {
  return (
    ratingPresetOptions.find((option) => option.value === value)?.label ??
    appI18n.t('works.list.filterAll')
  );
}

function getSmartFilterLabel(value: WorksSmartFilter | undefined) {
  return (
    smartFilterOptions.find((option) => option.value === value)?.label ??
    appI18n.t('works.list.filterAll')
  );
}

function getIdentityPresetLabel(value: WorksIdentityPreset | undefined) {
  return (
    identityPresetOptions.find((option) => option.value === value)?.label ??
    appI18n.t('works.list.filterAll')
  );
}

export function buildGenreFilterOptions(genreSuggestions: string[]) {
  return [
    { label: appI18n.t('works.list.filterAll'), value: '' },
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
    {
      label: appI18n.t('works.list.filterAll'),
      value: 'all' as const,
      count: totalActiveCount,
    },
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
    {
      count: totalCount,
      label: appI18n.t('works.list.filterAll'),
      value: 'all' as const,
    },
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
            label: appI18n.t('works.list.filterSeries', {
              value: query.series.trim(),
            }),
            onRemove: () => onQueryChange({ ...query, series: '' }),
          },
        ]
      : []),
    ...(query.contributor?.trim()
      ? [
          {
            label: appI18n.t('works.list.filterContributor', {
              value: query.contributor.trim(),
            }),
            onRemove: () => onQueryChange({ ...query, contributor: '' }),
          },
        ]
      : []),
    ...(query.personContributor?.trim()
      ? [
          {
            label: appI18n.t('works.list.filterPersonContributor', {
              value: query.personContributor.trim(),
            }),
            onRemove: () => onQueryChange({ ...query, personContributor: '' }),
          },
        ]
      : []),
    ...(query.organizationContributor?.trim()
      ? [
          {
            label: appI18n.t('works.list.filterOrganizationContributor', {
              value: query.organizationContributor.trim(),
            }),
            onRemove: () =>
              onQueryChange({ ...query, organizationContributor: '' }),
          },
        ]
      : []),
    ...(query.genre?.trim()
      ? [
          {
            label: appI18n.t('works.list.filterGenre', {
              value: query.genre.trim(),
            }),
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
            label: appI18n.t('works.list.filterSerial', {
              value: getSerialStatusLabel(query.serialStatus),
            }),
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
            label: appI18n.t('works.list.filterRating', {
              value: getRatingPresetLabel(query.ratingPreset),
            }),
            onRemove: () => onQueryChange({ ...query, ratingPreset: 'all' }),
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
            label: appI18n.t('works.list.filterIdentity', {
              value: getIdentityPresetLabel(query.identityPreset),
            }),
            onRemove: () => onQueryChange({ ...query, identityPreset: 'all' }),
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
            label: appI18n.t('works.list.filterSort', {
              value:
                workSortOptions.find((option) => option.value === query.sortBy)
                  ?.label ?? query.sortBy,
            }),
            onRemove: () => onQueryChange({ ...query, sortBy: 'updatedAt' }),
          },
        ]
      : []),
    ...(sortDirection !== defaultSortDirection
      ? [
          {
            label:
              sortDirection === 'asc'
                ? appI18n.t('works.list.sortAsc')
                : appI18n.t('works.list.sortDesc'),
            onRemove: () =>
              onQueryChange({ ...query, sortDirection: defaultSortDirection }),
          },
        ]
      : []),
  ];
}
