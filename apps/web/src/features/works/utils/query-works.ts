import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';

import {
  CONTRIBUTOR_GRAPH_TAG_KINDS,
  SERIES_GRAPH_TAG_KINDS,
  getGraphTags,
  getPersonalTags,
  matchesGraphTagValue,
  workOrganizationContributorValues,
  workPersonContributorValues,
  workContributorValues,
} from './graph-tags';
import { moveUnknownGenresToPersonalTags } from './work-genres';

export type WorksSortDirection = 'asc' | 'desc';
export type WorksSortOption =
  | 'completedAt'
  | 'createdAt'
  | 'lastConsumedAt'
  | 'rating'
  | 'startedAt'
  | 'title'
  | 'updatedAt';

export interface WorksListQuery {
  contributor?: string;
  genre?: string;
  organizationContributor?: string;
  personContributor?: string;
  rating: number | null;
  searchTerm: string;
  series?: string;
  tag?: string;
  type: WorkType | 'all';
  status: WorkStatus | 'all';
  sortBy: WorksSortOption;
  sortDirection?: WorksSortDirection;
}

export interface WorksGraphQueryIndex {
  contributorValuesByWorkId: Map<string, string[]>;
  organizationContributorValuesByWorkId: Map<string, string[]>;
  personContributorValuesByWorkId: Map<string, string[]>;
  seriesValuesByWorkId: Map<string, string[]>;
}

export const DEFAULT_WORKS_LIST_QUERY: WorksListQuery = {
  contributor: '',
  genre: '',
  organizationContributor: '',
  personContributor: '',
  rating: null,
  searchTerm: '',
  series: '',
  tag: '',
  type: 'all',
  status: 'all',
  sortBy: 'updatedAt',
  sortDirection: 'desc',
};

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function stripTrailingParenthetical(value: string) {
  return value.replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, '').trim();
}

function compactSearchText(value: string) {
  return stripTrailingParenthetical(normalizeSearchText(value)).replace(
    /[^\p{Letter}\p{Number}]+/gu,
    '',
  );
}

function createSearchSignals(value: string) {
  const normalized = normalizeSearchText(value);
  const stripped = stripTrailingParenthetical(normalized);

  return Array.from(
    new Set(
      [normalized, stripped, compactSearchText(value)].filter(Boolean),
    ),
  );
}

function getWorkSeriesValues(
  work: WorkRecord,
  graphIndex?: WorksGraphQueryIndex,
) {
  return graphIndex?.seriesValuesByWorkId.get(work.id) ?? getGraphTags(
    work.personalTags,
    SERIES_GRAPH_TAG_KINDS,
  ).map((tag) => tag.value);
}

function getWorkContributorValues(
  work: WorkRecord,
  graphIndex?: WorksGraphQueryIndex,
) {
  const graphValues = graphIndex?.contributorValuesByWorkId.get(work.id);

  if (graphValues && graphValues.length > 0) {
    return graphValues;
  }

  return workContributorValues(work);
}

function getWorkPersonContributorValues(
  work: WorkRecord,
  graphIndex?: WorksGraphQueryIndex,
) {
  const graphValues = graphIndex?.personContributorValuesByWorkId.get(work.id);

  if (graphValues && graphValues.length > 0) {
    return Array.from(
      new Set([...graphValues, ...workPersonContributorValues(work)]),
    );
  }

  return workPersonContributorValues(work);
}

function getWorkOrganizationContributorValues(
  work: WorkRecord,
  graphIndex?: WorksGraphQueryIndex,
) {
  const graphValues = graphIndex?.organizationContributorValuesByWorkId.get(work.id);

  if (graphValues && graphValues.length > 0) {
    return graphValues;
  }

  return workOrganizationContributorValues(work);
}

function matchesGraphValue(values: string[], value: string | undefined) {
  const normalizedValue = normalizeSearchText(value ?? '');

  if (!normalizedValue) {
    return true;
  }

  return values.some((entry) => normalizeSearchText(entry) === normalizedValue);
}

function getWorkPersonalTagValues(work: WorkRecord) {
  return moveUnknownGenresToPersonalTags(
    work.genres,
    getPersonalTags(work.personalTags),
  ).personalTags;
}

function matchesSearch(
  work: WorkRecord,
  searchTerm: string,
  graphIndex?: WorksGraphQueryIndex,
) {
  const normalizedSearch = normalizeSearchText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const searchSignals = createSearchSignals(searchTerm);
  const workSignals = [
    work.title,
    work.author,
    work.genres.join(' '),
    getWorkPersonalTagValues(work).join(' '),
    getGraphTags(work.personalTags)
      .map((tag) => tag.value)
      .join(' '),
    getWorkSeriesValues(work, graphIndex).join(' '),
    getWorkContributorValues(work, graphIndex).join(' '),
  ].flatMap(createSearchSignals);

  return searchSignals.some((searchSignal) =>
    workSignals.some((workSignal) => workSignal.includes(searchSignal)),
  );
}

function matchesStatus(work: WorkRecord, status: WorkStatus | 'all') {
  if (status === 'all') {
    return true;
  }

  return work.status === status;
}

function compareUpdatedAtDescending(a: WorkRecord, b: WorkRecord) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function getDefaultSortDirection(sortBy: WorksSortOption) {
  return sortBy === 'title' ? 'asc' : 'desc';
}

function compareIsoDateValues(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
  direction: WorksSortDirection,
) {
  const emptyValue = direction === 'asc' ? Number.POSITIVE_INFINITY : -1;
  const leftTime = leftValue ? new Date(leftValue).getTime() : emptyValue;
  const rightTime = rightValue ? new Date(rightValue).getTime() : emptyValue;
  const baseComparison = leftTime - rightTime;

  return direction === 'asc' ? baseComparison : -baseComparison;
}

function compareNumericValues(
  leftValue: number | null,
  rightValue: number | null,
  direction: WorksSortDirection,
) {
  const emptyValue = direction === 'asc' ? Number.POSITIVE_INFINITY : -1;
  const leftNumber = leftValue ?? emptyValue;
  const rightNumber = rightValue ?? emptyValue;
  const baseComparison = leftNumber - rightNumber;

  return direction === 'asc' ? baseComparison : -baseComparison;
}

export function queryWorks(
  works: WorkRecord[],
  query: WorksListQuery,
  graphIndex?: WorksGraphQueryIndex,
) {
  const filtered = works.filter((work) => {
    if (query.type !== 'all' && work.type !== query.type) {
      return false;
    }

    if (!matchesStatus(work, query.status)) {
      return false;
    }

    if (query.rating !== null) {
      return work.rating === query.rating;
    }

    if (
      query.tag?.trim() &&
      !getWorkPersonalTagValues(work).some(
        (tag) =>
          normalizeSearchText(tag) === normalizeSearchText(query.tag ?? ''),
      )
    ) {
      return false;
    }

    if (
      !matchesGraphTagValue(
        work.personalTags,
        SERIES_GRAPH_TAG_KINDS,
        query.series,
      ) &&
      !matchesGraphValue(getWorkSeriesValues(work, graphIndex), query.series)
    ) {
      return false;
    }

    if (
      query.contributor?.trim() &&
      !matchesGraphTagValue(
        work.personalTags,
        CONTRIBUTOR_GRAPH_TAG_KINDS,
        query.contributor,
      ) &&
      !getWorkContributorValues(work, graphIndex).some(
        (value) =>
          normalizeSearchText(value) ===
          normalizeSearchText(query.contributor ?? ''),
      )
    ) {
      return false;
    }

    if (
      query.personContributor?.trim() &&
      !getWorkPersonContributorValues(work, graphIndex).some(
        (value) =>
          normalizeSearchText(value) ===
          normalizeSearchText(query.personContributor ?? ''),
      )
    ) {
      return false;
    }

    if (
      query.organizationContributor?.trim() &&
      !getWorkOrganizationContributorValues(work, graphIndex).some(
        (value) =>
          normalizeSearchText(value) ===
          normalizeSearchText(query.organizationContributor ?? ''),
      )
    ) {
      return false;
    }

    if (
      query.genre?.trim() &&
      !work.genres.some(
        (genre) =>
          normalizeSearchText(genre) === normalizeSearchText(query.genre ?? ''),
      )
    ) {
      return false;
    }

    return matchesSearch(work, query.searchTerm, graphIndex);
  });

  const sortDirection = query.sortDirection ?? getDefaultSortDirection(query.sortBy);

  return filtered.sort((a, b) => {
    switch (query.sortBy) {
      case 'title':
        return (
          (sortDirection === 'asc'
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title)) || compareUpdatedAtDescending(a, b)
        );
      case 'rating':
        return (
          compareNumericValues(a.rating, b.rating, sortDirection) ||
          compareUpdatedAtDescending(a, b)
        );
      case 'createdAt':
        return (
          compareIsoDateValues(a.createdAt, b.createdAt, sortDirection) ||
          compareUpdatedAtDescending(a, b)
        );
      case 'lastConsumedAt':
        return (
          compareIsoDateValues(
            a.lastConsumedAt,
            b.lastConsumedAt,
            sortDirection,
          ) || compareUpdatedAtDescending(a, b)
        );
      case 'startedAt':
        return (
          compareIsoDateValues(a.startedAt, b.startedAt, sortDirection) ||
          compareUpdatedAtDescending(a, b)
        );
      case 'completedAt':
        return (
          compareIsoDateValues(a.completedAt, b.completedAt, sortDirection) ||
          compareUpdatedAtDescending(a, b)
        );
      case 'updatedAt':
      default:
        return (
          compareIsoDateValues(a.updatedAt, b.updatedAt, sortDirection) ||
          compareUpdatedAtDescending(a, b)
        );
    }
  });
}
