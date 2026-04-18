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
            {work.favorite && <span className="badge badge-accent">즐겨찾기</span>}
          </div>

          <div className="stack work-detail-title-block">
            <h2 className="page-title">{work.title}</h2>
            <p className="work-detail-author">
              {work.author || '작가/제작자 정보 없음'} · 최근 수정{' '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </p>
          </div>

          <div className="detail-spotlight">
            <p className="detail-spotlight-label">한줄 감상</p>
            <p className="detail-spotlight-copy">
              {work.shortReview ||
                '아직 한줄 감상이 없습니다. 짧게 메모해두면 나중에 다시 보기 편합니다.'}
            </p>
          </div>

          <div className="detail-stats-grid">
            <div className="stat-tile">
              <span className="stat-tile-label">별점</span>
              <strong>{work.rating === null ? '미평가' : `${work.rating}점`}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">장르</span>
              <strong>
                {work.genres.length > 0 ? `${work.genres.length}개 등록` : '없음'}
              </strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">티어</span>
              <strong>{tierLabel}</strong>
            </div>
          </div>

          {actions && <div className="button-row">{actions}</div>}
        </div>
      </div>

      <div className="detail-grid detail-grid--work">
        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">개요</p>
            <h3 className="section-title">작품 소개</h3>
          </div>
          <p>{work.description || '등록된 설명이 없습니다.'}</p>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">내 기록</p>
            <h3 className="section-title">개인 기록</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>상태</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>장르</dt>
              <dd>{work.genres.length > 0 ? work.genres.join(', ') : '없음'}</dd>
            </div>
            <div>
              <dt>즐겨찾기</dt>
              <dd>{work.favorite ? '등록됨' : '미등록'}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">감상</p>
            <h3 className="section-title">상세 감상</h3>
          </div>
          <p>{work.review || '아직 상세 감상이 없습니다.'}</p>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">동기화 정보</p>
            <h3 className="section-title">기록 및 동기화 정보</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>동기화 상태</dt>
              <dd>{syncLabel}</dd>
            </div>
            <div>
              <dt>등록일</dt>
              <dd>{formatWorkDateTime(work.createdAt)}</dd>
            </div>
            <div>
              <dt>수정일</dt>
              <dd>{formatWorkDateTime(work.updatedAt)}</dd>
            </div>
            <div>
              <dt>동기화 버전</dt>
              <dd>{work.serverVersion}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
