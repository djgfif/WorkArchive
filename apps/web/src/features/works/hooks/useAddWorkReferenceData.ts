import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { WorkRecord } from '@work-archive/shared-types';

import { useAuthSession } from '@features/auth';
import type { AddWorkSuggestions } from '../components/add-work-form.types';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';

function createEmptySuggestions(): AddWorkSuggestions {
  return {
    organizationContributorSuggestions: [],
    personContributorSuggestions: [],
    seriesSuggestions: [],
    tagSuggestions: [],
  };
}

export function useAddWorkReferenceData() {
  const { archiveScopeKey } = useAuthSession();
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
  const [workSuggestions, setWorkSuggestions] = useState<AddWorkSuggestions>(
    createEmptySuggestions,
  );

  useEffect(() => {
    const subscription = liveQuery(() => worksRepository.listAll()).subscribe({
      next: (works) => {
        setExistingWorks(works);
      },
      error: () => {
        setExistingWorks([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      worksService.listWorks(DEFAULT_WORKS_LIST_QUERY, 'active'),
    ).subscribe({
      next: ({
        organizationContributorSuggestions,
        personContributorSuggestions,
        seriesSuggestions,
        tagSuggestions,
      }) => {
        setWorkSuggestions({
          organizationContributorSuggestions,
          personContributorSuggestions,
          seriesSuggestions,
          tagSuggestions,
        });
      },
      error: () => {
        setWorkSuggestions(createEmptySuggestions());
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  return {
    existingWorks,
    workSuggestions,
  };
}
