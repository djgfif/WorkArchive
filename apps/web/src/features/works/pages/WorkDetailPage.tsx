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

function getSavedFeedback(value: string | null) {
  return value === 'edit' ? '로컬에 저장됨' : null;
}

export function WorkDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { archiveScopeKey, mode } = useAuthSession();
  const { error, isLoading, work } = useWorkDetail(id);
  usePageTitle(work?.title ?? '작품 상세');
  const [actionError, setActionError] = useState<string | null>(null);
  const routeFeedback =
    getRouteFeedback(location.state) ??
    getSavedFeedback(searchParams.get('saved'));
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
      handleActionSuccess('타임라인 기록을 추가했습니다.');
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : '타임라인 기록을 추가하지 못했습니다.',
      );
    }
  }

  async function handleDeleteTimelineEntry(id: string) {
    try {
      setActionError(null);
      setActionSuccess(null);
      await timelineEntriesService.deleteTimelineEntry(id);
      handleActionSuccess('타임라인 기록을 삭제했습니다.');
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : '타임라인 기록을 삭제하지 못했습니다.',
      );
    }
  }

  if (error) {
    return (
      <StateMessage
        description={error}
        title="작품 정보를 불러오지 못했습니다."
        tone="error"
      />
    );
  }

  if (isLoading) {
    return <LoadingState rows={3} title="작품 정보를 불러오는 중입니다" />;
  }

  if (!work) {
    return (
      <StateMessage
        actions={
          <AppLinkButton to="/works" tone="primary">
            작품으로 돌아가기
          </AppLinkButton>
        }
        description="삭제되었거나 주소가 올바르지 않을 수 있습니다."
        eyebrow="찾을 수 없음"
        title="해당 작품을 찾을 수 없습니다."
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
              작품으로 돌아가기
            </AppLinkButton>
            <AppLinkButton
              to={`/works/${work.id}/edit?focus=review`}
              tone="primary"
            >
              {work.shortReview.trim() || work.review.trim()
                ? '리뷰 수정'
                : '리뷰 쓰기'}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              전체 정보 수정
            </AppLinkButton>
          </>
        }
        onCreateTimelineEntry={handleCreateTimelineEntry}
        onDeleteTimelineEntry={handleDeleteTimelineEntry}
        graph={currentWorkGraph}
        overviewSections={
          <WorkQuickRecordSection
            onError={handleActionError}
            onSuccess={handleActionSuccess}
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
