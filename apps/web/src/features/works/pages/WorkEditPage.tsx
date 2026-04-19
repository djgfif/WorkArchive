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
    <section className="stack">
      <PageHero
        actions={
          <Link className="secondary-link" to={`/works/${work.id}`}>
            상세로 돌아가기
          </Link>
        }
        description="제목, 상태, 감상을 필요한 만큼만 다듬어보세요."
        eyebrow="수정"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{work.title}</span>
              <span className="stat-pill-label">현재 제목</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">저장 즉시 반영</span>
              <span className="stat-pill-label">작품 목록에 바로 반영</span>
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
