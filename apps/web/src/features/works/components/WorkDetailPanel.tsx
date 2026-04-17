import type { WorkRecord } from '@work-archive/shared-types';

import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkDetailPanelProps {
  work: WorkRecord;
}

export function WorkDetailPanel({ work }: WorkDetailPanelProps) {
  return (
    <section className="panel stack">
      <div className="detail-header">
        <div className="stack">
          <div className="badge-row">
            <span className="badge">{getWorkTypeLabel(work.type)}</span>
            <span className="badge">{getWorkStatusLabel(work.status)}</span>
            <span className="badge">{getWorkTierLabel(work.tier)}</span>
            <span className="badge">{getWorkSyncStatusLabel(work.syncStatus)}</span>
            {work.favorite && <span className="badge badge-accent">Favorite</span>}
          </div>
          <h2 className="page-title">{work.title}</h2>
          <p className="muted-copy">
            {work.author || 'Unknown creator'} · Updated{' '}
            {formatWorkUpdatedAt(work.updatedAt)}
          </p>
        </div>

        {work.thumbnailUrl ? (
          <img
            alt={`${work.title} cover`}
            className="thumbnail-preview"
            src={work.thumbnailUrl}
          />
        ) : (
          <div aria-hidden="true" className="thumbnail-placeholder">
            No cover
          </div>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-section">
          <h3>Overview</h3>
          <p>{work.description || 'No description yet.'}</p>
        </div>

        <div className="detail-section">
          <h3>Quick info</h3>
          <dl className="detail-list">
            <div>
              <dt>Rating</dt>
              <dd>{work.rating ?? 'Not rated'}</dd>
            </div>
            <div>
              <dt>Genres</dt>
              <dd>{work.genres.length > 0 ? work.genres.join(', ') : 'None'}</dd>
            </div>
            <div>
              <dt>Server version</dt>
              <dd>{work.serverVersion}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
          <h3>Short review</h3>
          <p>{work.shortReview || 'No short review yet.'}</p>
        </div>

        <div className="detail-section">
          <h3>Detailed review</h3>
          <p>{work.review || 'No detailed review yet.'}</p>
        </div>
      </div>
    </section>
  );
}
