import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { PageHero } from '../../../shared/components/PageHero';
import { QuickAddWorkForm } from '../components/QuickAddWorkForm';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';

export function WorkCreatePage() {
  const navigate = useNavigate();
  const [formVersion, setFormVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedWork, setSavedWork] = useState<WorkRecord | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);

      setSavedWork(work);
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
            작품으로 돌아가기
          </Link>
        }
        description="검색에서 시작하고, 자동 채움된 초안을 확인한 뒤 개인 기록만 남기는 Quick Add 구조로 정리했습니다."
        eyebrow="작품 추가"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">검색 우선</span>
              <span className="stat-pill-label">최종 구조 반영</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">개인 기록 최소 입력</span>
              <span className="stat-pill-label">상태 · 별점 · 한줄평</span>
            </div>
          </>
        }
        title="작품 추가"
      />

      {savedWork ? (
        <section className="panel stack quick-add-complete-card">
          <div className="section-heading">
            <p className="section-kicker">저장 완료</p>
            <h2 className="section-title">{savedWork.title}을(를) 등록했습니다</h2>
            <p className="section-description">
              계속 추가하거나, 방금 등록한 작품 상세로 바로 이동할 수 있습니다.
            </p>
          </div>

          <div className="button-row">
            <button
              onClick={() => {
                setSavedWork(null);
                setSubmitError(null);
                setFormVersion((currentValue) => currentValue + 1);
              }}
              type="button"
            >
              계속 추가
            </button>
            <button onClick={() => navigate(`/works/${savedWork.id}`)} type="button">
              방금 등록한 작품 보기
            </button>
            <Link className="secondary-link" to="/works">
              작품 목록 보기
            </Link>
          </div>
        </section>
      ) : (
        <QuickAddWorkForm
          isSubmitting={isSubmitting}
          key={formVersion}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      )}
    </section>
  );
}
