import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkCardProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  work: WorkRecord;
}

export function WorkCard({ onDelete, work }: WorkCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const visibleGenres = work.genres.slice(0, 3);

  return (
    <article className="panel work-card">
      <Link
        aria-label={`Open ${work.title}`}
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
          {work.favorite && <span className="badge badge-accent">Favorite</span>}
        </div>
      </Link>

      <div className="work-card-body">
        <div className="work-card-heading">
          <div className="stack work-card-title-block">
            <div className="badge-row">
              <span className="badge">{statusLabel}</span>
              <span className="badge">{tierLabel}</span>
            </div>
            <h3 className="card-title">
              <Link className="text-link" to={`/works/${work.id}`}>
                {work.title}
              </Link>
            </h3>
            <p className="muted-copy">
              {work.author || 'Unknown creator'} · Updated{' '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </p>
          </div>

          <div className="work-card-score">
            <span className="work-card-score-value">
              {work.rating === null ? '—' : work.rating}
            </span>
            <span className="work-card-score-label">Rating</span>
          </div>
        </div>

        <p className="card-summary">
          {work.shortReview || work.description || 'No notes yet.'}
        </p>

        <div className="work-card-footer">
          <div className="tag-list" aria-label="Genres">
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
              <span className="tag tag--muted">No genres</span>
            )}
          </div>

          <div className="button-row">
            <Link className="secondary-link" to={`/works/${work.id}`}>
              View
            </Link>
            <Link className="secondary-link" to={`/works/${work.id}/edit`}>
              Edit
            </Link>
            <button
              aria-label={`Delete ${work.title}`}
              className="danger-button"
              onClick={() => void onDelete(work)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
