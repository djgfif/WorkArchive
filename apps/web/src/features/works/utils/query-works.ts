import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';

export type WorksSortOption = 'updatedAt' | 'title' | 'rating';

export interface WorksListQuery {
  searchTerm: string;
  tag?: string;
  type: WorkType | 'all';
  status: WorkStatus | 'all';
  sortBy: WorksSortOption;
}

export const DEFAULT_WORKS_LIST_QUERY: WorksListQuery = {
  searchTerm: '',
  tag: '',
  type: 'all',
  status: 'all',
  sortBy: 'updatedAt',
};

function matchesSearch(work: WorkRecord, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    work.title,
    work.author,
    work.shortReview,
    work.review,
    work.description,
    work.genres.join(' '),
    work.personalTags.join(' '),
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
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
