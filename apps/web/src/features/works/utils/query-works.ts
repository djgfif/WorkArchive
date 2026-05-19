import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';

export type WorksSortOption = 'updatedAt' | 'title' | 'rating';

export interface WorksListQuery {
  rating: number | null;
  searchTerm: string;
  tag?: string;
  type: WorkType | 'all';
  status: WorkStatus | 'all';
  sortBy: WorksSortOption;
}

export const DEFAULT_WORKS_LIST_QUERY: WorksListQuery = {
  rating: null,
  searchTerm: '',
  tag: '',
  type: 'all',
  status: 'all',
  sortBy: 'updatedAt',
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

function matchesSearch(work: WorkRecord, searchTerm: string) {
  const normalizedSearch = normalizeSearchText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const searchSignals = createSearchSignals(searchTerm);
  const workSignals = [
    work.title,
    work.author,
    work.shortReview,
    work.review,
    work.description,
    work.genres.join(' '),
    work.personalTags.join(' '),
  ].flatMap(createSearchSignals);

  return searchSignals.some((searchSignal) =>
    workSignals.some((workSignal) => workSignal.includes(searchSignal)),
  );
}

function compareUpdatedAtDescending(a: WorkRecord, b: WorkRecord) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function queryWorks(works: WorkRecord[], query: WorksListQuery) {
  const filtered = works.filter((work) => {
    if (query.type !== 'all' && work.type !== query.type) {
      return false;
    }

    if (query.status !== 'all' && work.status !== query.status) {
      return false;
    }

    if (query.rating !== null) {
      return work.rating === query.rating;
    }

    if (
      query.tag?.trim() &&
      !work.personalTags.some(
        (tag) => tag.toLowerCase() === query.tag?.trim().toLowerCase(),
      )
    ) {
      return false;
    }

    return matchesSearch(work, query.searchTerm);
  });

  return filtered.sort((a, b) => {
    switch (query.sortBy) {
      case 'title':
        return a.title.localeCompare(b.title) || compareUpdatedAtDescending(a, b);
      case 'rating': {
        const leftRating = a.rating ?? -1;
        const rightRating = b.rating ?? -1;

        return rightRating - leftRating || compareUpdatedAtDescending(a, b);
      }
      case 'updatedAt':
      default:
        return compareUpdatedAtDescending(a, b);
    }
  });
}
