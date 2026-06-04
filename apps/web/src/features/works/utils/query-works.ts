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
export type WorksRatingPreset = 'all' | 'gte3' | 'gte4' | 'lte2' | 'unrated';
export type WorksSmartFilter = 'all' | 'favorites' | 'needsCuration' | 'unrated';
export type WorksIdentityPreset =
  | 'all'
  | 'catalogLinked'
  | 'imported'
  | 'manual';

export interface WorksListQuery {
  contributor?: string;
  genre?: string;
  identityPreset?: WorksIdentityPreset;
  organizationContributor?: string;
  personContributor?: string;
  rating: number | null;
  ratingPreset?: WorksRatingPreset;
  searchTerm: string;
  series?: string;
  smartFilter?: WorksSmartFilter;
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
  identityPreset: 'all',
  organizationContributor: '',
  personContributor: '',
  rating: null,
  ratingPreset: 'all',
  searchTerm: '',
  series: '',
  smartFilter: 'all',
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

function createSearchQuerySignals(searchTerm: string) {
  const normalized = normalizeSearchText(searchTerm);
  const signals = createSearchSignals(searchTerm);
  const tokenSignals = Array.from(
    new Set(
      normalized
        .split(' ')
        .flatMap(createSearchSignals)
        .filter((signal) => signal.length >= 2),
    ),
  );

  return {
    normalized,
    signals,
    tokenSignals,
  };
}

interface SearchField {
  values: string[];
  weight: number;
}

function scoreSearchField(field: SearchField, searchSignals: string[]) {
  let score = 0;

  for (const value of field.values) {
    const valueSignals = createSearchSignals(value);

    for (const searchSignal of searchSignals) {
      for (const valueSignal of valueSignals) {
        if (valueSignal === searchSignal) {
          score = Math.max(score, field.weight * 4);
          continue;
        }

        if (valueSignal.startsWith(searchSignal)) {
          score = Math.max(score, field.weight * 3);
          continue;
        }

        if (valueSignal.includes(searchSignal)) {
          score = Math.max(score, field.weight);
        }
      }
    }
  }

  return score;
}

function searchFieldIncludes(field: SearchField, searchSignal: string) {
  return field.values
    .flatMap(createSearchSignals)
    .some((valueSignal) => valueSignal.includes(searchSignal));
}

function createWorkSearchFields(
  work: WorkRecord,
  graphIndex?: WorksGraphQueryIndex,
): SearchField[] {
  return [
    {
      values: [work.title],
      weight: 100,
    },
    {
      values: [work.author],
      weight: 72,
    },
    {
      values: getWorkSeriesValues(work, graphIndex),
      weight: 64,
    },
    {
      values: getWorkContributorValues(work, graphIndex),
      weight: 58,
    },
    {
      values: getWorkPersonalTagValues(work),
      weight: 46,
    },
    {
      values: work.genres,
      weight: 36,
    },
    {
      values: getGraphTags(work.personalTags).map((tag) => tag.value),
      weight: 32,
    },
  ];
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

function getWorkSearchScore(
  work: WorkRecord,
  searchTerm: string,
  graphIndex?: WorksGraphQueryIndex,
) {
  const searchQuery = createSearchQuerySignals(searchTerm);

  if (!searchQuery.normalized) {
    return 1;
  }

  const fields = createWorkSearchFields(work, graphIndex);
  const fieldScores = fields.map((field) =>
    scoreSearchField(field, searchQuery.signals),
  );
  const strongestFieldScore = Math.max(...fieldScores);
  const supportingFieldScore = fieldScores.reduce((total, score) => total + score, 0);
  const score = strongestFieldScore * 10 + supportingFieldScore;
  const tokenMatched =
    searchQuery.tokenSignals.length > 1 &&
    searchQuery.tokenSignals.every((tokenSignal) =>
      fields.some((field) => searchFieldIncludes(field, tokenSignal)),
    );

  if (score > 0) {
    return score;
  }

  return tokenMatched ? 1 : 0;
}

function matchesStatus(work: WorkRecord, status: WorkStatus | 'all') {
  if (status === 'all') {
    return true;
  }

  return work.status === status;
}

function matchesRatingPreset(
  work: WorkRecord,
  ratingPreset: WorksRatingPreset,
) {
  switch (ratingPreset) {
    case 'unrated':
      return work.rating === null;
    case 'gte4':
      return work.rating !== null && work.rating >= 4;
    case 'gte3':
      return work.rating !== null && work.rating >= 3;
    case 'lte2':
      return work.rating !== null && work.rating <= 2;
    case 'all':
    default:
      return true;
  }
}

function needsCuration(work: WorkRecord) {
  return (
    work.rating === null ||
    work.shortReview.trim() === '' ||
    work.genres.length === 0 ||
    work.thumbnailUrl.trim() === '' ||
    getWorkPersonalTagValues(work).length === 0
  );
}

function matchesSmartFilter(work: WorkRecord, smartFilter: WorksSmartFilter) {
  switch (smartFilter) {
    case 'favorites':
      return work.favorite;
    case 'unrated':
      return work.rating === null;
    case 'needsCuration':
      return needsCuration(work);
    case 'all':
    default:
      return true;
  }
}

function matchesIdentityPreset(
  work: WorkRecord,
  identityPreset: WorksIdentityPreset,
) {
  switch (identityPreset) {
    case 'manual':
      return !work.catalogTitleId && !work.importDraft;
    case 'imported':
      return Boolean(work.importDraft);
    case 'catalogLinked':
      return Boolean(work.catalogTitleId);
    case 'all':
    default:
      return true;
  }
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

function compareWorks(
  a: WorkRecord,
  b: WorkRecord,
  sortBy: WorksSortOption,
  sortDirection: WorksSortDirection,
) {
  switch (sortBy) {
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
}

export function queryWorks(
  works: WorkRecord[],
  query: WorksListQuery,
  graphIndex?: WorksGraphQueryIndex,
) {
  const searchTerm = query.searchTerm.trim();
  const hasSearchTerm = normalizeSearchText(searchTerm).length > 0;
  const filtered = works.flatMap((work) => {
    if (query.type !== 'all' && work.type !== query.type) {
      return [];
    }

    if (!matchesStatus(work, query.status)) {
      return [];
    }

    if (query.rating !== null && work.rating !== query.rating) {
      return [];
    }

    if (
      query.rating === null &&
      !matchesRatingPreset(work, query.ratingPreset ?? 'all')
    ) {
      return [];
    }

    if (!matchesSmartFilter(work, query.smartFilter ?? 'all')) {
      return [];
    }

    if (!matchesIdentityPreset(work, query.identityPreset ?? 'all')) {
      return [];
    }

    if (
      query.tag?.trim() &&
      !getWorkPersonalTagValues(work).some(
        (tag) =>
          normalizeSearchText(tag) === normalizeSearchText(query.tag ?? ''),
      )
    ) {
      return [];
    }

    if (
      !matchesGraphTagValue(
        work.personalTags,
        SERIES_GRAPH_TAG_KINDS,
        query.series,
      ) &&
      !matchesGraphValue(getWorkSeriesValues(work, graphIndex), query.series)
    ) {
      return [];
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
      return [];
    }

    if (
      query.personContributor?.trim() &&
      !getWorkPersonContributorValues(work, graphIndex).some(
        (value) =>
          normalizeSearchText(value) ===
          normalizeSearchText(query.personContributor ?? ''),
      )
    ) {
      return [];
    }

    if (
      query.organizationContributor?.trim() &&
      !getWorkOrganizationContributorValues(work, graphIndex).some(
        (value) =>
          normalizeSearchText(value) ===
          normalizeSearchText(query.organizationContributor ?? ''),
      )
    ) {
      return [];
    }

    if (
      query.genre?.trim() &&
      !work.genres.some(
        (genre) =>
          normalizeSearchText(genre) === normalizeSearchText(query.genre ?? ''),
      )
    ) {
      return [];
    }

    const searchScore = getWorkSearchScore(work, searchTerm, graphIndex);

    if (hasSearchTerm && searchScore === 0) {
      return [];
    }

    return [{ searchScore, work }];
  });

  const sortDirection = query.sortDirection ?? getDefaultSortDirection(query.sortBy);

  return filtered
    .sort((a, b) => {
      if (hasSearchTerm && a.searchScore !== b.searchScore) {
        return b.searchScore - a.searchScore;
      }

      return compareWorks(a.work, b.work, query.sortBy, sortDirection);
    })
    .map(({ work }) => work);
}
