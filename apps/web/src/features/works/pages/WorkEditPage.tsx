import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
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
  const { error, isLoading, work } = useWorkDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    if (!id) {
      setSubmitError('작품 정보를 찾을 수 없습니다.');
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
        <p className="muted-copy">수정 화면을 준비하고 있습니다.</p>
      </section>
    );
  }

  if (!work) {
    return (
      <section className="panel stack">
        <h2 className="section-title">수정할 작품을 찾을 수 없습니다.</h2>
        <div className="button-row">
          <Link className="primary-link" to="/works">
            라이브러리로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageHero
        actions={
          <Link className="secondary-link" to={`/works/${work.id}`}>
            상세로 돌아가기
          </Link>
        }
        description="기록은 유지한 채 제목, 감상, 상태를 자연스럽게 다듬어보세요."
        eyebrow="작품 수정"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{work.title}</span>
              <span className="stat-pill-label">현재 제목</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">즉시 반영</span>
              <span className="stat-pill-label">저장하면 바로 라이브러리에 반영</span>
            </div>
          </>
        }
        title={`${work.title} 수정`}
      />

      <WorkForm
        cancelTo={`/works/${work.id}`}
        initialValues={createWorkFormValuesFromRecord(work)}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="저장"
      />
    </section>
  );
}
