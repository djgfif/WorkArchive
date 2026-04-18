import type { ReactNode } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  formatWorkDateTime,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkDetailPanelProps {
  actions?: ReactNode;
  work: WorkRecord;
}

export function WorkDetailPanel({ actions, work }: WorkDetailPanelProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const syncLabel = getWorkSyncStatusLabel(work.syncStatus);

  return (
    <section className="panel detail-shell">
      <div className="work-detail-hero">
        <ArtworkPoster
          className="work-detail-poster"
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="detail"
        />

        <div className="work-detail-copy">
          <div className="badge-row">
            <span className="badge">{typeLabel}</span>
            <span className="badge">{statusLabel}</span>
            <span className="badge">{tierLabel}</span>
            <span className="badge">{syncLabel}</span>
            {work.favorite && <span className="badge badge-accent">Favorite</span>}
          </div>

          <div className="stack work-detail-title-block">
            <h2 className="page-title">{work.title}</h2>
            <p className="work-detail-author">
              {work.author || 'Unknown creator'} · Updated{' '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </p>
          </div>

          <div className="detail-spotlight">
            <p className="detail-spotlight-label">Personal note</p>
            <p className="detail-spotlight-copy">
              {work.shortReview ||
                'No quick impression yet. Add a short note to make this entry easier to scan later.'}
            </p>
          </div>

          <div className="detail-stats-grid">
            <div className="stat-tile">
              <span className="stat-tile-label">Rating</span>
              <strong>{work.rating === null ? 'Not rated' : `${work.rating}/5`}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Genres</span>
              <strong>
                {work.genres.length > 0 ? `${work.genres.length} tagged` : 'None yet'}
              </strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Tier</span>
              <strong>{tierLabel}</strong>
            </div>
          </div>

          {actions && <div className="button-row">{actions}</div>}
        </div>
      </div>

      <div className="detail-grid detail-grid--work">
        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">Overview</p>
            <h3 className="section-title">About this work</h3>
          </div>
          <p>{work.description || 'No description saved yet.'}</p>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">Your archive</p>
            <h3 className="section-title">Personal details</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>Status</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>Genres</dt>
              <dd>{work.genres.length > 0 ? work.genres.join(', ') : 'None yet'}</dd>
            </div>
            <div>
              <dt>Favorite</dt>
              <dd>{work.favorite ? 'Marked favorite' : 'Not marked'}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">Review</p>
            <h3 className="section-title">Long-form notes</h3>
          </div>
          <p>{work.review || 'No detailed review yet.'}</p>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">Archive status</p>
            <h3 className="section-title">Sync and record metadata</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>Sync state</dt>
              <dd>{syncLabel}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatWorkDateTime(work.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatWorkDateTime(work.updatedAt)}</dd>
            </div>
            <div>
              <dt>Server version</dt>
              <dd>{work.serverVersion}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
