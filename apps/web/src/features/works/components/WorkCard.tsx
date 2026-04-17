import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

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
  return (
    <article className="panel work-card">
      <div className="card-header">
        <div>
          <div className="badge-row">
            <span className="badge">{getWorkTypeLabel(work.type)}</span>
            <span className="badge">{getWorkStatusLabel(work.status)}</span>
            <span className="badge">{getWorkTierLabel(work.tier)}</span>
            {work.favorite && <span className="badge badge-accent">Favorite</span>}
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
      </div>

      <p className="card-summary">
        {work.shortReview || work.description || 'No summary yet.'}
      </p>

      <dl className="card-meta">
        <div>
          <dt>Rating</dt>
          <dd>{work.rating ?? 'Not rated'}</dd>
        </div>
        <div>
          <dt>Genres</dt>
          <dd>{work.genres.length > 0 ? work.genres.join(', ') : 'None'}</dd>
        </div>
      </dl>

      <div className="button-row">
        <Link className="secondary-link" to={`/works/${work.id}`}>
          View
        </Link>
        <Link className="secondary-link" to={`/works/${work.id}/edit`}>
          Edit
        </Link>
        <button
          className="danger-button"
          onClick={() => void onDelete(work)}
          type="button"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
