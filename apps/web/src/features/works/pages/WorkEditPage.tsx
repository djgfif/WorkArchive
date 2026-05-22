import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  AppLinkButton,
  LoadingState,
  MetricPill,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { FlowPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth';
import { syncQueueRepository } from '../../sync';
import { WorkForm } from '../components/WorkForm';
import { useWorkDetail } from '../hooks/useWorkDetail';
import {
  graphRepository,
  type WorkGraphSnapshot,
} from '../services/graph.repository';
import { buildWorkFormDraftKey } from '../services/work-form-draft.service';
import { worksService } from '../services/works.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';
import {
  createWorkFormValuesFromRecord,
  type UpsertWorkInput,
} from '../utils/work-form';

export function WorkEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { archiveScopeKey, mode } = useAuthSession();
  const [searchParams] = useSearchParams();
  const { error, isLoading, work } = useWorkDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [workSuggestions, setWorkSuggestions] = useState({
    organizationContributorSuggestions: [] as string[],
    personContributorSuggestions: [] as string[],
    seriesSuggestions: [] as string[],
    tagSuggestions: [] as string[],
  });
  const [workGraph, setWorkGraph] = useState<WorkGraphSnapshot | null>(null);
  const focusArea = searchParams.get('focus') === 'review' ? 'review' : 'general';
  const draftKey = id
    ? buildWorkFormDraftKey({
        archiveScopeKey,
        focusArea,
        mode: 'edit',
        workId: id,
      })
    : null;
  const formInitialValues = useMemo(
    () =>
      work ? createWorkFormValuesFromRecord(work, workGraph ?? undefined) : undefined,
    [work, workGraph],
  );

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
        setWorkSuggestions({
          organizationContributorSuggestions: [],
          personContributorSuggestions: [],
          seriesSuggestions: [],
          tagSuggestions: [],
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!work) {
      setWorkGraph(null);

      return undefined;
    }

    const subscription = liveQuery(() =>
      graphRepository.getWorkGraph(work.id),
    ).subscribe({
      next: setWorkGraph,
      error: () => setWorkGraph(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [work]);

  async function handleSubmit(input: UpsertWorkInput) {
    if (!id) {
      setSubmitError('수정할 작품을 찾을 수 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await worksService.updateWork(id, input);
      const hasQueuedWork =
        mode === 'authenticated' &&
        (await syncQueueRepository.hasQueuedWork(id));

      navigate(`/works/${id}?saved=edit`, {
        state: {
          feedback: hasQueuedWork
            ? '로컬에 저장됨 · 백업 대기 중'
            : '로컬에 저장됨',
        },
      });
    } catch (saveError) {
      setSubmitError(
        saveError instanceof Error ? saveError.message : '작품을 수정하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
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
        title="수정할 작품을 찾을 수 없습니다."
        tone="info"
      />
    );
  }

  return (
    <FlowPageTemplate>
      <PageHero
        actions={
          <>
            <AppLinkButton to={`/works/${work.id}`}>작품으로 돌아가기</AppLinkButton>
            {focusArea === 'review' && (
              <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
                전체 수정 모드
              </AppLinkButton>
            )}
          </>
        }
        description={
          focusArea === 'review'
            ? '이번에는 감상 기록에만 집중합니다. 한줄평과 상세 감상만 정리해도 충분합니다.'
            : '제목, 상태, 감상을 필요한 만큼만 다듬어보세요.'
        }
        eyebrow="수정"
        meta={
          <>
            <MetricPill label="현재 제목" value={work.title} />
            <MetricPill
              label="작업 방식"
              value={focusArea === 'review' ? '리뷰 집중 모드' : '전체 수정'}
            />
          </>
        }
        title={focusArea === 'review' ? `${work.title} 감상 수정` : `${work.title} 수정`}
      />

      <WorkForm
        catalogTitleId={work.catalogTitleId ?? null}
        cancelTo={`/works/${work.id}`}
        currentWorkId={work.id}
        draftKey={draftKey}
        focusArea={focusArea}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        organizationContributorSuggestions={
          workSuggestions.organizationContributorSuggestions
        }
        personContributorSuggestions={workSuggestions.personContributorSuggestions}
        seriesSuggestions={workSuggestions.seriesSuggestions}
        submitError={submitError}
        submitLabel="저장"
        tagSuggestions={workSuggestions.tagSuggestions}
        {...(formInitialValues ? { initialValues: formInitialValues } : {})}
      />
    </FlowPageTemplate>
  );
}
