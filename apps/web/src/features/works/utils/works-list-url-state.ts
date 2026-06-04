import {
  SERIAL_STATUSES,
  WORK_STATUSES,
  WORK_TYPES,
} from '@work-archive/shared-types';
import type { SerialStatus, WorkRecord } from '@work-archive/shared-types';

import {
  DEFAULT_WORKS_LIST_QUERY,
  getDefaultSortDirection,
  type WorksIdentityPreset,
  type WorksListQuery,
  type WorksRatingPreset,
  type WorksSmartFilter,
} from './query-works';

export type WorksListRouteViewMode = 'grid' | 'list';
export type WorksListRouteCollectionScope = 'active' | 'trash';

function normalizeStatusQueryParam(
  value: string | null,
): WorksListQuery['status'] {
  return value &&
    WORK_STATUSES.includes(value as (typeof WORK_STATUSES)[number])
    ? (value as WorksListQuery['status'])
    : DEFAULT_WORKS_LIST_QUERY.status;
}

function normalizeSerialStatusQueryParam(
  value: string | null,
): SerialStatus | 'all' {
  return value &&
    SERIAL_STATUSES.includes(value as (typeof SERIAL_STATUSES)[number])
    ? (value as SerialStatus)
    : 'all';
}

function normalizeRatingPresetQueryParam(
  value: string | null,
): WorksRatingPreset {
  return value === 'unrated' ||
    value === 'gte4' ||
    value === 'gte3' ||
    value === 'lte2'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.ratingPreset ?? 'all');
}

function normalizeSmartFilterQueryParam(
  value: string | null,
): WorksSmartFilter {
  return value === 'favorites' ||
    value === 'unrated' ||
    value === 'needsCuration'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.smartFilter ?? 'all');
}

function normalizeIdentityPresetQueryParam(
  value: string | null,
): WorksIdentityPreset {
  return value === 'manual' ||
    value === 'imported' ||
    value === 'catalogLinked'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.identityPreset ?? 'all');
}

export function getCollectionScopeFromSearchParams(
  searchParams: URLSearchParams,
): WorksListRouteCollectionScope {
  return searchParams.get('scope') === 'trash' ? 'trash' : 'active';
}

export function getViewModeFromSearchParams(
  searchParams: URLSearchParams,
): WorksListRouteViewMode {
  return searchParams.get('view') === 'list' ? 'list' : 'grid';
}

export function getDeletedWorkFromRouteState(state: unknown) {
  if (!state || typeof state !== 'object' || !('deletedWork' in state)) {
    return null;
  }

  const deletedWork = (state as { deletedWork?: unknown }).deletedWork;

  if (!deletedWork || typeof deletedWork !== 'object') {
    return null;
  }

  return deletedWork as WorkRecord;
}

export function getQueryFromSearchParams(
  searchParams: URLSearchParams,
): WorksListQuery {
  const ratingFromUrl = Number.parseFloat(searchParams.get('rating') ?? '');
  const statusFromUrl = searchParams.get('status');
  const typeFromUrl = searchParams.get('type');
  const sortByFromUrl = searchParams.get('sort');
  const sortDirectionFromUrl = searchParams.get('dir');
  const sortBy =
    sortByFromUrl === 'title' ||
    sortByFromUrl === 'rating' ||
    sortByFromUrl === 'createdAt' ||
    sortByFromUrl === 'lastConsumedAt' ||
    sortByFromUrl === 'startedAt' ||
    sortByFromUrl === 'completedAt'
      ? sortByFromUrl
      : DEFAULT_WORKS_LIST_QUERY.sortBy;

  return {
    ...DEFAULT_WORKS_LIST_QUERY,
    contributor: searchParams.get('contributor') ?? '',
    genre: searchParams.get('genre') ?? '',
    organizationContributor: searchParams.get('organizationContributor') ?? '',
    personContributor: searchParams.get('personContributor') ?? '',
    identityPreset: normalizeIdentityPresetQueryParam(
      searchParams.get('identity'),
    ),
    rating:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? ratingFromUrl
        : DEFAULT_WORKS_LIST_QUERY.rating,
    ratingPreset:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? 'all'
        : normalizeRatingPresetQueryParam(searchParams.get('ratingPreset')),
    searchTerm: searchParams.get('q') ?? '',
    series: searchParams.get('series') ?? '',
    smartFilter: normalizeSmartFilterQueryParam(searchParams.get('smart')),
    tag: searchParams.get('tag') ?? '',
    sortBy,
    sortDirection:
      sortDirectionFromUrl === 'asc' || sortDirectionFromUrl === 'desc'
        ? sortDirectionFromUrl
        : getDefaultSortDirection(sortBy),
    status: normalizeStatusQueryParam(statusFromUrl),
    serialStatus: normalizeSerialStatusQueryParam(searchParams.get('serial')),
    type:
      typeFromUrl &&
      WORK_TYPES.includes(typeFromUrl as (typeof WORK_TYPES)[number])
        ? (typeFromUrl as WorksListQuery['type'])
        : DEFAULT_WORKS_LIST_QUERY.type,
  };
}

export function buildSearchParams(
  query: WorksListQuery,
  scope: WorksListRouteCollectionScope,
  viewMode: WorksListRouteViewMode,
) {
  const nextSearchParams = new URLSearchParams();

  if (query.searchTerm.trim()) nextSearchParams.set('q', query.searchTerm.trim());
  if (query.series?.trim()) nextSearchParams.set('series', query.series.trim());
  if (query.contributor?.trim()) {
    nextSearchParams.set('contributor', query.contributor.trim());
  }
  if (query.personContributor?.trim()) {
    nextSearchParams.set('personContributor', query.personContributor.trim());
  }
  if (query.organizationContributor?.trim()) {
    nextSearchParams.set(
      'organizationContributor',
      query.organizationContributor.trim(),
    );
  }
  if (query.genre?.trim()) nextSearchParams.set('genre', query.genre.trim());
  if (query.status !== 'all') nextSearchParams.set('status', query.status);
  if ((query.serialStatus ?? 'all') !== 'all') {
    nextSearchParams.set('serial', query.serialStatus ?? 'all');
  }
  if (query.rating !== null) nextSearchParams.set('rating', query.rating.toString());
  if (query.rating === null && (query.ratingPreset ?? 'all') !== 'all') {
    nextSearchParams.set('ratingPreset', query.ratingPreset ?? 'all');
  }
  if ((query.smartFilter ?? 'all') !== 'all') {
    nextSearchParams.set('smart', query.smartFilter ?? 'all');
  }
  if ((query.identityPreset ?? 'all') !== 'all') {
    nextSearchParams.set('identity', query.identityPreset ?? 'all');
  }
  if (query.tag?.trim()) nextSearchParams.set('tag', query.tag.trim());
  if (query.type !== 'all') nextSearchParams.set('type', query.type);
  if (query.sortBy !== DEFAULT_WORKS_LIST_QUERY.sortBy) {
    nextSearchParams.set('sort', query.sortBy);
  }
  const sortDirection =
    query.sortDirection ?? getDefaultSortDirection(query.sortBy);
  if (sortDirection !== getDefaultSortDirection(query.sortBy)) {
    nextSearchParams.set('dir', sortDirection);
  }
  if (scope === 'trash') nextSearchParams.set('scope', 'trash');
  if (scope === 'active' && viewMode === 'list') nextSearchParams.set('view', 'list');

  return nextSearchParams;
}

export function hasActiveWorksListFilters(query: WorksListQuery) {
  return (
    query.searchTerm.trim() !== '' ||
    (query.series?.trim() ?? '') !== '' ||
    (query.contributor?.trim() ?? '') !== '' ||
    (query.personContributor?.trim() ?? '') !== '' ||
    (query.organizationContributor?.trim() ?? '') !== '' ||
    (query.genre?.trim() ?? '') !== '' ||
    (query.tag?.trim() ?? '') !== '' ||
    query.rating !== null ||
    (query.ratingPreset ?? 'all') !== 'all' ||
    (query.smartFilter ?? 'all') !== 'all' ||
    (query.identityPreset ?? 'all') !== 'all' ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    (query.serialStatus ?? 'all') !== 'all' ||
    query.sortBy !== 'updatedAt' ||
    (query.sortDirection ?? getDefaultSortDirection(query.sortBy)) !==
      getDefaultSortDirection(query.sortBy)
  );
}
