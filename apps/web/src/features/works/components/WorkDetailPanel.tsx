import type { ReactNode } from 'react';
import { Stack } from '@mantine/core';

import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkContributorRole,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import {
  getContributorEntries,
  getGraphTagKindLabel,
  getPersonalTags,
  getSeriesTagValues,
  workContributorValues,
} from '../utils/graph-tags';
import type { WorkGraphSnapshot } from '../services/graph.repository';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from './archive-display';
import { WorkDetailHero } from './WorkDetailHero';
import {
  WorkDetailTabs,
  type WorkDetailContributorEntry,
} from './WorkDetailTabs';
import { WorkDetailTimelineTab } from './WorkDetailTimelineTab';
import { buildWorkDetailTimelineItems } from '../utils/work-detail-timeline';

const WORK_CONTRIBUTOR_ROLE_LABELS: Partial<
  Record<WorkContributorRole, string>
> = {
  artist: '아티스트',
  author: '작가',
  director: '감독',
  illustrator: '일러스트',
  original_creator: '원작',
  platform: '플랫폼',
  production_company: '제작사',
  publisher: '출판사',
  screenwriter: '각본',
  studio: '스튜디오',
  translator: '번역',
};

function getWorkContributorRoleLabel(role: WorkContributorRole) {
  return WORK_CONTRIBUTOR_ROLE_LABELS[role] ?? role;
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

interface WorkDetailPanelProps {
  actions?: ReactNode;
  graph?: WorkGraphSnapshot | null;
  onCreateTimelineEntry?: (input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) => Promise<void>;
  onDeleteTimelineEntry?: (id: string) => Promise<void>;
  overviewSections?: ReactNode;
  progressSections?: ReactNode;
  relatedSections?: ReactNode;
  timelineEntries?: TimelineEntryRecord[];
  work: WorkRecord;
}

function getGraphContributorEntries(
  graph: WorkGraphSnapshot | null | undefined,
): WorkDetailContributorEntry[] {
  const graphContributorsById = new Map(
    graph?.contributors.map((contributor) => [contributor.id, contributor]) ??
      [],
  );

  return (
    graph?.workContributors
      .map((link) => {
        const contributor = graphContributorsById.get(link.contributorId);

        return contributor
          ? {
              key: `${link.role}-${contributor.id}`,
              label: getWorkContributorRoleLabel(link.role),
              value: contributor.name,
            }
          : null;
      })
      .filter(
        (entry): entry is WorkDetailContributorEntry => entry !== null,
      ) ?? []
  );
}

function getContributorDisplayEntries(
  work: WorkRecord,
  graph: WorkGraphSnapshot | null | undefined,
) {
  const graphContributorEntries = getGraphContributorEntries(graph);

  return graphContributorEntries.length > 0
    ? graphContributorEntries
    : getContributorEntries(work.personalTags).map((entry) => ({
        key: `${entry.kind}-${entry.value}`,
        label: getGraphTagKindLabel(entry.kind),
        value: entry.value,
      }));
}

function getSeriesTags(
  work: WorkRecord,
  graph: WorkGraphSnapshot | null | undefined,
) {
  const graphSeriesById = new Map(
    graph?.series.map((series) => [series.id, series]) ?? [],
  );
  const graphSeriesTags = uniqueValues(
    graph?.workSeriesLinks
      .map((link) => graphSeriesById.get(link.seriesId)?.title ?? '')
      .filter(Boolean) ?? [],
  );

  return graphSeriesTags.length > 0
    ? graphSeriesTags
    : getSeriesTagValues(work.personalTags);
}

function getSourceIdentityLabel(work: WorkRecord) {
  if (work.catalogTitleId) {
    return '카탈로그 연결됨';
  }

  return work.importDraft ? '외부 검색 초안' : '직접 기록';
}

export function WorkDetailPanel({
  actions,
  graph,
  onCreateTimelineEntry,
  onDeleteTimelineEntry,
  overviewSections,
  progressSections,
  relatedSections,
  timelineEntries = [],
  work,
}: WorkDetailPanelProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();
  const personalTags = getPersonalTags(work.personalTags);
  const seriesTags = getSeriesTags(work, graph);
  const contributorEntries = getContributorDisplayEntries(work, graph);
  const contributorValues =
    contributorEntries.length > 0
      ? uniqueValues(contributorEntries.map((entry) => entry.value))
      : workContributorValues(work);
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);
  const timelineItems = buildWorkDetailTimelineItems(work, timelineEntries);
  const latestTimelineItem = timelineItems.at(-1) ?? null;

  return (
    <Stack gap="xl">
      <WorkDetailHero
        actions={actions}
        latestTimelineItem={latestTimelineItem}
        personalTags={personalTags}
        progressLabel={progressLabel}
        progressPercent={progressPercent}
        shortReview={shortReview}
        statusLabel={statusLabel}
        typeLabel={typeLabel}
        work={work}
      />

      <WorkDetailTabs
        contributorEntries={contributorEntries}
        contributorValues={contributorValues}
        latestTimelineItem={latestTimelineItem}
        overviewSections={overviewSections}
        personalTags={personalTags}
        progressLabel={progressLabel}
        progressSections={progressSections}
        relatedSections={relatedSections}
        review={review}
        seriesTags={seriesTags}
        shortReview={shortReview}
        sourceIdentityLabel={getSourceIdentityLabel(work)}
        statusLabel={statusLabel}
        timelinePanel={
          <WorkDetailTimelineTab
            progressLabel={progressLabel}
            statusLabel={statusLabel}
            timelineItems={timelineItems}
            work={work}
            {...(onCreateTimelineEntry ? { onCreateTimelineEntry } : {})}
            {...(onDeleteTimelineEntry ? { onDeleteTimelineEntry } : {})}
          />
        }
        typeLabel={typeLabel}
        work={work}
      />
    </Stack>
  );
}
