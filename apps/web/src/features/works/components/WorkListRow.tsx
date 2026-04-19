import type { WorkStatus, WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  formatWorkUpdatedAt,
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';

export interface WorkQuickUpdate {
  rating?: number | null;
  status?: WorkStatus;
}

interface WorkListRowProps {
  isUpdating: boolean;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  work: WorkRecord;
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function WorkListRow({
  isUpdating,
  onDelete,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const rowClassName = isUpdating
    ? 'works-list-row works-list-row--updating'
    : 'works-list-row';

  return (
    <article className={rowClassName}>
      <Link
        aria-label={`${work.title} 상세 보기`}
        className="works-list-row-cover"
        to={`/works/${work.id}`}
      >
        <ArtworkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="row"
        />
      </Link>

      <div className="works-list-row-main">
        <div className="works-list-row-topline">
          {work.favorite && <span className="badge badge-accent">즐겨찾기</span>}
          {isUpdating && <span className="mode-badge">반영 중</span>}
        </div>

        <div className="stack works-list-row-copy">
          <h3 className="card-title">
            <Link className="text-link" to={`/works/${work.id}`}>
              {work.title}
            </Link>
          </h3>
          <p className="muted-copy">
            {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
            {formatWorkUpdatedAt(work.updatedAt)}
          </p>
          <p className="card-summary">
            {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
          </p>
        </div>
      </div>

      <div className="works-list-row-type">
        <span className="works-list-label">타입</span>
        <strong>{typeLabel}</strong>
      </div>

      <label className="works-list-control-card" htmlFor={`rating-${work.id}`}>
        <span className="works-list-label">별점</span>
        <select
          aria-label={`${work.title} 별점`}
          disabled={isUpdating}
          id={`rating-${work.id}`}
          onChange={(event) => {
            const nextValue =
              event.target.value === '' ? null : Number.parseFloat(event.target.value);

            void onQuickUpdate(work, {
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
        <span className="works-list-helper">{formatRatingLabel(work.rating)}</span>
      </label>

      <label className="works-list-control-card" htmlFor={`status-${work.id}`}>
        <span className="works-list-label">상태</span>
        <select
          aria-label={`${work.title} 상태`}
          disabled={isUpdating}
          id={`status-${work.id}`}
          onChange={(event) =>
            void onQuickUpdate(work, {
              status: event.target.value as WorkStatus,
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
        <span className="works-list-helper">빠르게 변경 가능</span>
      </label>

      <div className="works-list-row-actions">
        <div className="button-row works-list-row-action-buttons">
          <Link className="secondary-link" to={`/works/${work.id}`}>
            보기
          </Link>
          <Link className="secondary-link" to={`/works/${work.id}/edit`}>
            수정
          </Link>
          <button
            aria-label={`${work.title} 삭제`}
            className="danger-button"
            disabled={isUpdating}
            onClick={() => void onDelete(work)}
            type="button"
          >
            삭제
          </button>
        </div>
        <p className="works-trash-hint">
          삭제하면 지금은 목록에서 숨겨집니다.
        </p>
      </div>
    </article>
  );
}
