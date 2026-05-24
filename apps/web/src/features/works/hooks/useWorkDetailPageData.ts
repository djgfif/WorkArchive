import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type {
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';
import { isVolumeRecordableWorkType } from '@work-archive/shared-types';

import {
  graphRepository,
  type WorkGraphSnapshot,
} from '../services/graph.repository';
import { releaseRecordsService } from '../services/release-records.service';
import { recentWorkViewsService } from '../services/recent-work-views.service';
import { timelineEntriesRepository } from '../services/timeline-entries.repository';
import {
  fetchRelatedCatalogTitles,
  fetchUserRecordReleases,
  type RelatedCatalogTitlesResponse,
  type UserRecordReleasesResponse,
} from '../services/user-records.api';
import { worksRepository } from '../services/works.repository';

export function useWorkDetailPageData({
  archiveScopeKey,
  mode,
  work,
}: {
  archiveScopeKey: string;
  mode: 'authenticated' | 'guest';
  work: WorkRecord | null;
}) {
  const [releaseData, setReleaseData] =
    useState<UserRecordReleasesResponse | null>(null);
  const [relatedData, setRelatedData] =
    useState<RelatedCatalogTitlesResponse | null>(null);
  const [localReleaseRecords, setLocalReleaseRecords] = useState<
    UserReleaseRecord[]
  >([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntryRecord[]>(
    [],
  );
  const [localWorks, setLocalWorks] = useState<WorkRecord[]>([]);
  const [localGraph, setLocalGraph] = useState<WorkGraphSnapshot | null>(null);
  const workCatalogTitleId = work?.catalogTitleId ?? null;
  const workId = work?.id ?? null;
  const workType = work?.type ?? null;

  useEffect(() => {
    if (!workId) {
      return;
    }

    recentWorkViewsService.recordView(archiveScopeKey, workId);
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    if (!workId) {
      setLocalReleaseRecords([]);

      return undefined;
    }

    const subscription = liveQuery(() =>
      releaseRecordsService.listByUserWorkRecord(workId),
    ).subscribe({
      next: setLocalReleaseRecords,
      error: () => {
        setLocalReleaseRecords([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    if (!workId) {
      setTimelineEntries([]);

      return undefined;
    }

    const subscription = liveQuery(() =>
      timelineEntriesRepository.listByWorkId(workId),
    ).subscribe({
      next: setTimelineEntries,
      error: () => {
        setTimelineEntries([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      worksRepository.listActive(),
    ).subscribe({
      next: setLocalWorks,
      error: () => setLocalWorks([]),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      graphRepository.listActiveGraph(),
    ).subscribe({
      next: setLocalGraph,
      error: () => setLocalGraph(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    let isActive = true;

    async function loadReleaseData() {
      if (
        !workId ||
        mode !== 'authenticated' ||
        !workCatalogTitleId ||
        !workType ||
        !isVolumeRecordableWorkType(workType)
      ) {
        setReleaseData(null);

        return;
      }

      try {
        const response = await fetchUserRecordReleases(workId);

        if (isActive) {
          setReleaseData(response);
        }
      } catch {
        if (isActive) {
          setReleaseData(null);
        }
      }
    }

    void loadReleaseData();

    return () => {
      isActive = false;
    };
  }, [mode, workCatalogTitleId, workId, workType]);

  useEffect(() => {
    let isActive = true;

    async function loadRelatedTitles() {
      if (!workCatalogTitleId || mode !== 'authenticated') {
        setRelatedData(null);

        return;
      }

      try {
        const response = await fetchRelatedCatalogTitles(workCatalogTitleId);

        if (isActive) {
          setRelatedData(response);
        }
      } catch {
        if (isActive) {
          setRelatedData(null);
        }
      }
    }

    void loadRelatedTitles();

    return () => {
      isActive = false;
    };
  }, [mode, workCatalogTitleId]);

  return {
    localGraph,
    localReleaseRecords,
    localWorks,
    relatedData,
    releaseData,
    timelineEntries,
  };
}
