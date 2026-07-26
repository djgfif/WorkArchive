import { useEffect, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import type { TimelineEntryType } from '@work-archive/shared-types';

import {
  AppLinkButton,
  FeedbackMessage,
  LoadingState,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { DetailPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import {
  ProgressOnlySection,
  VolumeRecordsSection,
  WorkQuickRecordSection,
} from '../components/WorkDetailRecordSections';
import {
  LocalContributorSection,
  LocalSeriesSection,
  RelatedTitlesSection,
} from '../components/WorkDetailRelatedSections';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { useWorkDetailPageData } from '../hooks/useWorkDetailPageData';
import type { WorkGraphSnapshot } from '../services/graph.repository';
import { timelineEntriesService } from '../services/timeline-entries.service';

function getRouteFeedback(state: unknown) {
  if (!state || typeof state !== 'object' || !('feedback' in state)) {
    return null;
  }

  const feedback = (state as { feedback?: unknown }).feedback;

  return typeof feedback === 'string' ? feedback : null;
}

function getSavedFeedback(
  value: string | null,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  return value === 'edit' ? t('works.feedback.localSaved') : null;
}

export function WorkDetailPage() {
  const { t } = useAppTranslation();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { archiveScopeKey, mode } = useAuthSession();
  const { error, isLoading, work } = useWorkDetail(id);
  usePageTitle(work?.title ?? t('works.detail.pageTitle'));
  const [actionError, setActionError] = useState<string | null>(null);
  const routeFeedback =
    getRouteFeedback(location.state) ??
    getSavedFeedback(searchParams.get('saved'), t);
  const [actionSuccess, setActionSuccess] = useState<string | null>(
    () => routeFeedback,
  );
  const {
    localGraph,
    localReleaseRecords,
    localWorks,
    relatedData,
    releaseData,
    timelineEntries,
  } = useWorkDetailPageData({
    archiveScopeKey,
    mode,
    work,
  });

  function handleActionError(message: string | null) {
    setActionError(message);

    if (message) {
      setActionSuccess(null);
    }
  }

  function handleActionSuccess(message: string) {
    setActionError(null);
    setActionSuccess(message);
  }

  useEffect(() => {
    if (!routeFeedback) {
      return;
    }

    setActionError(null);
    setActionSuccess(routeFeedback);
  }, [routeFeedback]);

  useEffect(() => {
    if (!actionSuccess) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionSuccess(null);
    }, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionSuccess]);

  async function handleCreateTimelineEntry(input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) {
    if (!work) {
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);
      await timelineEntriesService.createTimelineEntry({
        ...input,
        workId: work.id,
      });
      handleActionSuccess(t('works.detail.timelineCreateSuccess'));
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : t('works.detail.timelineCreateError'),
      );
    }
  }

  async function handleDeleteTimelineEntry(id: string) {
    try {
      setActionError(null);
      setActionSuccess(null);
      await timelineEntriesService.deleteTimelineEntry(id);
      handleActionSuccess(t('works.detail.timelineDeleteSuccess'));
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : t('works.detail.timelineDeleteError'),
      );
    }
  }

  if (error) {
    return (
      <StateMessage
        description={error}
        title={t('works.detail.loadingErrorTitle')}
        tone="error"
      />
    );
  }

  if (isLoading) {
    return <LoadingState rows={3} title={t('works.detail.loadingTitle')} />;
  }

  if (!work) {
    return (
      <StateMessage
        actions={
          <AppLinkButton to="/works" tone="primary">
            {t('works.backToWork')}
          </AppLinkButton>
        }
        description={t('works.detail.missingDescription')}
        eyebrow={t('works.detail.missingEyebrow')}
        title={t('works.detail.missingTitle')}
        tone="info"
      />
    );
  }

  const currentWorkGraph: WorkGraphSnapshot | null = localGraph
    ? {
        contributors: localGraph.contributors,
        relations: localGraph.relations.filter(
          (relation) =>
            relation.sourceWorkId === work.id ||
            relation.targetWorkId === work.id,
        ),
        series: localGraph.series,
        workContributors: localGraph.workContributors.filter(
          (link) => link.workId === work.id,
        ),
        workRelations: localGraph.workRelations.filter(
          (relation) =>
            relation.sourceWorkId === work.id ||
            relation.targetWorkId === work.id,
        ),
        workSeriesLinks: localGraph.workSeriesLinks.filter(
          (link) => link.workId === work.id,
        ),
      }
    : null;

  return (
    <DetailPageTemplate>
      {actionError && (
        <FeedbackMessage tone="error">{actionError}</FeedbackMessage>
      )}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      <WorkDetailPanel
        actions={
          <>
            <AppLinkButton to="/works" tone="quiet">
              {t('works.backToWork')}
            </AppLinkButton>
            <AppLinkButton
              to={`/works/${work.id}/edit?focus=review`}
              tone="primary"
            >
              {work.shortReview.trim() || work.review.trim()
                ? t('works.detail.editReview')
                : t('works.detail.writeReview')}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              {t('works.detail.editFull')}
            </AppLinkButton>
          </>
        }
        onCreateTimelineEntry={handleCreateTimelineEntry}
        onDeleteTimelineEntry={handleDeleteTimelineEntry}
        graph={currentWorkGraph}
        quickRecordSection={
          <WorkQuickRecordSection
            onError={handleActionError}
            onSuccess={handleActionSuccess}
            variant="hero"
            work={work}
          />
        }
        progressSections={
          <>
            <ProgressOnlySection
              onError={handleActionError}
              onSuccess={handleActionSuccess}
              work={work}
            />
            <VolumeRecordsSection
              localRecords={localReleaseRecords}
              onError={handleActionError}
              onSuccess={handleActionSuccess}
              releaseData={releaseData}
              work={work}
            />
          </>
        }
        relatedSections={
          <>
            <LocalSeriesSection
              currentWork={work}
              graph={localGraph}
              works={localWorks}
            />
            <LocalContributorSection
              currentWork={work}
              graph={localGraph}
              works={localWorks}
            />
            <RelatedTitlesSection relatedData={relatedData} />
          </>
        }
        timelineEntries={timelineEntries}
        work={work}
      />
    </DetailPageTemplate>
  );
}
