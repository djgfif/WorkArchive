import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import {
  FeedbackMessage,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import { workStatusOptions } from '../utils/work-options';

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

export function WorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQuickUpdating, setIsQuickUpdating] = useState(false);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '현재는 목록에서 숨겨집니다.',
      title: `"${work.title}"을 삭제할까요?`,
    });

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      navigate('/works');
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleQuickUpdate(nextValues: {
    rating?: number | null;
    status?: (typeof workStatusOptions)[number]['value'];
  }) {
    if (!work) {
      return;
    }

    try {
      setActionError(null);
      setIsQuickUpdating(true);

      const latestWork = await worksService.getWorkById(work.id);

      if (!latestWork) {
        throw new Error('작품을 찾을 수 없습니다.');
      }

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '작품 기록을 바로 수정하지 못했습니다.',
      );
    } finally {
      setIsQuickUpdating(false);
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
          <Link className="primary-link" to="/works">
            작품으로 돌아가기
          </Link>
        }
        description="삭제되었거나 주소가 올바르지 않을 수 있습니다."
        eyebrow="찾을 수 없음"
        title="해당 작품을 찾을 수 없습니다."
        tone="info"
      />
    );
  }

  return (
    <DetailPageTemplate>
      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}

      <WorkDetailPanel
        actions={
          <>
            <Link className="secondary-link" to="/works">
              작품으로 돌아가기
            </Link>
            <Link className="secondary-link" to={`/works/${work.id}/edit`}>
              수정
            </Link>
            <button
              className="danger-button"
              onClick={() => void handleDelete()}
              type="button"
            >
              삭제
            </button>
          </>
        }
        quickEdit={
          <section
            className={
              isQuickUpdating
                ? 'detail-quick-edit detail-quick-edit--busy'
                : 'detail-quick-edit'
            }
          >
            <div className="detail-quick-edit-header">
              <div className="section-heading">
                <p className="section-kicker">빠른 수정</p>
                <h3 className="section-title">상태와 별점은 여기서 바로 바꿉니다</h3>
                <p className="muted-copy">
                  짧은 정리는 상세에서 끝내고, 감상 문장은 리뷰 편집으로 이어갈 수 있습니다.
                </p>
              </div>
              {isQuickUpdating && <span className="mode-badge">반영 중</span>}
            </div>

            <div className="detail-quick-edit-grid">
              <label className="works-list-control-card" htmlFor={`detail-status-${work.id}`}>
                <span className="works-list-label">상태</span>
                <select
                  aria-label={`${work.title} 상세 상태`}
                  disabled={isQuickUpdating}
                  id={`detail-status-${work.id}`}
                  onChange={(event) =>
                    void handleQuickUpdate({
                      status: event.target.value as (typeof workStatusOptions)[number]['value'],
                    })
                  }
                  value={work.status}
                >
                  {workStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="works-list-helper">목록에 돌아가지 않고 수정</span>
              </label>

              <label className="works-list-control-card" htmlFor={`detail-rating-${work.id}`}>
                <span className="works-list-label">별점</span>
                <select
                  aria-label={`${work.title} 상세 별점`}
                  disabled={isQuickUpdating}
                  id={`detail-rating-${work.id}`}
                  onChange={(event) => {
                    const nextValue =
                      event.target.value === ''
                        ? null
                        : Number.parseFloat(event.target.value);

                    void handleQuickUpdate({
                      rating: Number.isNaN(nextValue) ? null : nextValue,
                    });
                  }}
                  value={work.rating?.toString() ?? ''}
                >
                  <option value="">미평가</option>
                  {ratingOptions.map((option) => (
                    <option key={option.value} value={option.value.toString()}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="works-list-helper">감상 우선순위가 바로 갱신됩니다</span>
              </label>

              <div className="detail-review-shortcut">
                <span className="mode-badge">리뷰</span>
                <h3 className="section-title">
                  {work.shortReview.trim() || work.review.trim()
                    ? '감상 문장 다듬기'
                    : '리뷰 쓰기 시작'}
                </h3>
                <p className="muted-copy">
                  한줄평과 상세 감상은 리뷰 편집 모드에서 더 집중해서 정리할 수 있습니다.
                </p>
                <div className="button-row">
                  <Link
                    className="secondary-link"
                    to={`/works/${work.id}/edit?focus=review`}
                  >
                    {work.shortReview.trim() || work.review.trim()
                      ? '리뷰 수정'
                      : '리뷰 쓰기'}
                  </Link>
                  <Link className="secondary-link" to={`/works/${work.id}/edit`}>
                    전체 정보 수정
                  </Link>
                </div>
              </div>
            </div>
          </section>
        }
        work={work}
      />
    </DetailPageTemplate>
  );
}
