import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkCardProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  work: WorkRecord;
}

export function WorkCard({ onDelete, work }: WorkCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const visibleGenres = work.genres.slice(0, 3);
  const ratingLabel = work.rating === null ? '미평가' : `${work.rating.toFixed(1)}점`;

  return (
    <article className="panel work-card">
      <Link
        aria-label={`${work.title} 보기`}
        className="work-card-media"
        to={`/works/${work.id}`}
      >
        <ArtworkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="card"
        />
        <div className="work-card-media-overlay">
          <span className="badge">{typeLabel}</span>
          {work.favorite && <span className="badge badge-accent">즐겨찾기</span>}
        </div>
      </Link>

      <div className="work-card-body">
        <div className="badge-row">
          <span className="badge">{statusLabel}</span>
          <span className="badge">{ratingLabel}</span>
        </div>

        <div className="work-card-heading">
          <div className="stack work-card-title-block">
            <h3 className="card-title">
              <Link className="text-link" to={`/works/${work.id}`}>
                {work.title}
              </Link>
            </h3>
            <p className="muted-copy">
              {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </p>
          </div>

          <div className="work-card-score">
            <span className="work-card-score-value">
              {work.rating === null ? '—' : work.rating}
            </span>
            <span className="work-card-score-label">별점</span>
          </div>
        </div>

        <p className="card-summary">
          {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
        </p>

        <div className="work-card-meta-grid">
          <div className="work-card-meta-item">
            <span className="works-list-label">타입</span>
            <strong>{typeLabel}</strong>
          </div>
          <div className="work-card-meta-item">
            <span className="works-list-label">상태</span>
            <strong>{statusLabel}</strong>
          </div>
          <div className="work-card-meta-item">
            <span className="works-list-label">장르</span>
            <strong>
              {visibleGenres.length > 0 ? visibleGenres.join(', ') : '장르 없음'}
            </strong>
          </div>
        </div>

        <div className="work-card-footer">
          <div className="tag-list" aria-label="장르">
            {visibleGenres.length > 0 ? (
              <>
                {visibleGenres.map((genre) => (
                  <span className="tag" key={genre}>
                    {genre}
                  </span>
                ))}
                {work.genres.length > visibleGenres.length && (
                  <span className="tag">+{work.genres.length - visibleGenres.length}</span>
                )}
              </>
            ) : (
              <span className="tag tag--muted">장르 없음</span>
            )}
          </div>

          <div className="button-row">
            <Link className="secondary-link" to={`/works/${work.id}`}>
              상세
            </Link>
            <Link className="secondary-link" to={`/works/${work.id}/edit`}>
              수정
            </Link>
            <button
              aria-label={`${work.title} 삭제`}
              className="danger-button"
              onClick={() => void onDelete(work)}
              type="button"
            >
              삭제
            </button>
          </div>

          <p className="work-card-action-note">
            삭제하면 현재 목록에서 숨겨집니다.
          </p>
        </div>
      </div>
    </article>
  );
}
