import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { PageHero } from '../../../shared/components/PageHero';
import { FlowPageTemplate } from '../../../shared/components/PageTemplates';
import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import { QuickAddWorkForm } from '../components/QuickAddWorkForm';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

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
    <FlowPageTemplate>
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

          <div className="quick-add-complete-preview">
            <ArtworkPoster
              thumbnailUrl={savedWork.thumbnailUrl}
              title={savedWork.title}
              typeLabel={getWorkTypeLabel(savedWork.type)}
              variant="row"
            />
            <div className="stack">
              <div className="badge-row">
                <span className="badge">{getWorkTypeLabel(savedWork.type)}</span>
                <span className="badge">{getWorkStatusLabel(savedWork.status)}</span>
                <span className="badge">
                  {savedWork.rating === null ? '미평가' : `${savedWork.rating.toFixed(1)}점`}
                </span>
              </div>
              <p className="card-title">{savedWork.title}</p>
              <p className="muted-copy">
                {savedWork.author || '작가·제작자 미입력'}
              </p>
            </div>
          </div>

          <div className="quick-add-complete-actions">
            <button
              aria-label="계속 추가"
              className="quick-add-complete-action quick-add-complete-action--primary"
              onClick={() => {
                setSavedWork(null);
                setSubmitError(null);
                setFormVersion((currentValue) => currentValue + 1);
              }}
              type="button"
            >
              <span className="mode-badge">연속 기록</span>
              <span className="section-title">계속 추가</span>
              <span className="muted-copy">다음 작품을 바로 이어서 등록합니다.</span>
            </button>

            <button
              aria-label="방금 등록한 작품 보기"
              className="quick-add-complete-action"
              onClick={() => navigate(`/works/${savedWork.id}`)}
              type="button"
            >
              <span className="badge">상세 보기</span>
              <span className="section-title">방금 등록한 작품 보기</span>
              <span className="muted-copy">
                저장한 기록을 상세 화면에서 바로 확인합니다.
              </span>
            </button>
          </div>

          <div className="button-row">
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
    </FlowPageTemplate>
  );
}
