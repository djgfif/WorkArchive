import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { WorkForm } from '../components/WorkForm';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';

export function WorkCreatePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);

      navigate(`/works/${work.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : '작품을 추가하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <PageHero
        actions={
          <Link className="secondary-link" to="/works">
            라이브러리로 돌아가기
          </Link>
        }
        description="먼저 기본 정보만 간단히 저장하고, 감상은 나중에 이어서 정리할 수 있습니다."
        eyebrow="빠른 추가"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">빠르게</span>
              <span className="stat-pill-label">가볍게 기록</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">이 기기에 저장</span>
              <span className="stat-pill-label">바로 보관</span>
            </div>
          </>
        }
        title="작품 추가"
      />

      <WorkForm
        cancelTo="/works"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="저장"
      />
    </section>
  );
}
