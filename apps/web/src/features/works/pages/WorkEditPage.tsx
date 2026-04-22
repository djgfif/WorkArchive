import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  AppLinkButton,
  MetricPill,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { FlowPageTemplate } from '../../../shared/components/PageTemplates';
import { WorkForm } from '../components/WorkForm';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';
import {
  createWorkFormValuesFromRecord,
  type UpsertWorkInput,
} from '../utils/work-form';

export function WorkEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { error, isLoading, work } = useWorkDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const focusArea = searchParams.get('focus') === 'review' ? 'review' : 'general';

  async function handleSubmit(input: UpsertWorkInput) {
    if (!id) {
      setSubmitError('수정할 작품을 찾을 수 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await worksService.updateWork(id, input);

      navigate(`/works/${id}`);
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
    return (
      <StateMessage
        description="잠시만 기다려주세요."
        title="작품 정보를 불러오는 중입니다."
        tone="loading"
      />
    );
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
        cancelTo={`/works/${work.id}`}
        focusArea={focusArea}
        initialValues={createWorkFormValuesFromRecord(work)}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="저장"
      />
    </FlowPageTemplate>
  );
}
