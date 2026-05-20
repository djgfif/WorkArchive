import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { WorkRecord, WorkType } from '@work-archive/shared-types';

import { worksRepository } from '../services/works.repository';

export function normalizeDuplicateTitle(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

interface FindDuplicateCandidatesInput {
  catalogTitleId?: string | null;
  currentWorkId?: string | null;
  title: string;
  type: WorkType;
  works: WorkRecord[];
}

export function findDuplicateWorkCandidates({
  catalogTitleId,
  currentWorkId,
  title,
  type,
  works,
}: FindDuplicateCandidatesInput) {
  const normalizedTitle = normalizeDuplicateTitle(title);

  if (!catalogTitleId && !normalizedTitle) {
    return [];
  }

  return works
    .filter((work) => {
      if (work.id === currentWorkId || work.deletedAt !== null) {
        return false;
      }

      if (catalogTitleId && work.catalogTitleId === catalogTitleId) {
        return true;
      }

      return (
        work.type === type &&
        normalizedTitle.length > 0 &&
        normalizeDuplicateTitle(work.title) === normalizedTitle
      );
    })
    .sort((left, right) => {
      const leftCatalogMatch =
        catalogTitleId && left.catalogTitleId === catalogTitleId ? 0 : 1;
      const rightCatalogMatch =
        catalogTitleId && right.catalogTitleId === catalogTitleId ? 0 : 1;

      return (
        leftCatalogMatch - rightCatalogMatch ||
        right.updatedAt.localeCompare(left.updatedAt)
      );
    })
    .slice(0, 3);
}

export function useDuplicateWorkCandidates(
  input: Omit<FindDuplicateCandidatesInput, 'works'>,
) {
  const [activeWorks, setActiveWorks] = useState<WorkRecord[]>([]);

  useEffect(() => {
    const subscription = liveQuery(() => worksRepository.listActive()).subscribe({
      next: setActiveWorks,
      error: () => setActiveWorks([]),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return findDuplicateWorkCandidates({
    ...input,
    works: activeWorks,
  });
}
