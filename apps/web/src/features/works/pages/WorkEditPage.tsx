import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
      <section className="panel stack">
        <h2 className="section-title">작품 정보를 불러오지 못했습니다.</h2>
        <p className="muted-copy">{error}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel stack">
        <h2 className="section-title">작품 정보를 불러오는 중입니다.</h2>
        <p className="muted-copy">잠시만 기다려주세요.</p>
      </section>
    );
  }

  if (!work) {
    return (
      <section className="panel stack">
        <h2 className="section-title">수정할 작품을 찾을 수 없습니다.</h2>
        <div className="button-row">
          <Link className="primary-link" to="/works">
            작품으로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <FlowPageTemplate>
      <PageHero
        actions={
          <>
            <Link className="secondary-link" to={`/works/${work.id}`}>
              상세로 돌아가기
            </Link>
            {focusArea === 'review' && (
              <Link className="secondary-link" to={`/works/${work.id}/edit`}>
                전체 수정 모드
              </Link>
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
            <div className="stat-pill">
              <span className="stat-pill-value">{work.title}</span>
              <span className="stat-pill-label">현재 제목</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">
                {focusArea === 'review' ? '리뷰 집중 모드' : '저장 즉시 반영'}
              </span>
              <span className="stat-pill-label">
                {focusArea === 'review'
                  ? '감상 문장을 먼저 정리'
                  : '작품 목록에 바로 반영'}
              </span>
            </div>
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
