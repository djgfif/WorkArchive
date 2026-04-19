import { useState, type ReactNode } from 'react';

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

interface ReviewSectionProps {
  body: string;
  collapsedLabel: string;
  emptyCopy: string;
  expandedLabel: string;
  eyebrow: string;
  previewMaxLength?: number;
  previewFallback: string;
  title: string;
}

function summarizeText(value: string, maxLength = 92) {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function ReviewSection({
  body,
  collapsedLabel,
  emptyCopy,
  expandedLabel,
  eyebrow,
  previewMaxLength,
  previewFallback,
  title,
}: ReviewSectionProps) {
  const trimmedBody = body.trim();
  const hasContent = trimmedBody !== '';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={isExpanded ? 'detail-review-card detail-review-card--open' : 'detail-review-card'}>
      <div className="detail-review-card-header">
        <div className="section-heading">
          <p className="section-kicker">{eyebrow}</p>
          <h3 className="section-title">{title}</h3>
          <p className="detail-review-preview">
            {hasContent
              ? summarizeText(trimmedBody, previewMaxLength)
              : previewFallback}
          </p>
        </div>

        {hasContent ? (
          <button
            className="secondary-link detail-review-toggle"
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
            type="button"
          >
            {isExpanded ? expandedLabel : collapsedLabel}
          </button>
        ) : null}
      </div>

      <div className="detail-review-body">
        {hasContent ? (
          isExpanded ? <p>{trimmedBody}</p> : null
        ) : (
          <p>{emptyCopy}</p>
        )}
      </div>
    </section>
  );
}

function getPrimaryRecord(work: WorkRecord, statusLabel: string) {
  if (work.rating !== null) {
    return {
      description:
        work.status === 'completed'
          ? '완료한 작품으로 기록된 감상입니다.'
          : `${statusLabel} 상태에서 남긴 평점입니다.`,
      label: '내 평점',
      value: `${work.rating.toFixed(1)}점`,
    };
  }

  return {
    description:
      work.status === 'planned'
        ? '아직 보기 전이라 상태를 먼저 보여줍니다.'
        : '평점을 남기기 전이라 상태를 먼저 보여줍니다.',
    label: '현재 상태',
    value: statusLabel,
  };
}

export function WorkDetailPanel({ actions, work }: WorkDetailPanelProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const syncLabel = getWorkSyncStatusLabel(work.syncStatus);
  const primaryRecord = getPrimaryRecord(work, statusLabel);

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
            <span className="badge">{syncLabel}</span>
            {work.favorite && <span className="badge badge-accent">즐겨찾기</span>}
          </div>

          <div className="stack work-detail-title-block">
            <h2 className="page-title">{work.title}</h2>
            <p className="work-detail-author">
              {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </p>
          </div>

          <div className="detail-primary-record">
            <p className="detail-primary-record-label">{primaryRecord.label}</p>
            <p className="detail-primary-record-value">{primaryRecord.value}</p>
            <p className="muted-copy">{primaryRecord.description}</p>
          </div>

          <div className="detail-summary-grid">
            <div className="stat-tile">
              <span className="stat-tile-label">상태</span>
              <strong>{statusLabel}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">타입</span>
              <strong>{typeLabel}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">한줄평</span>
              <strong>{work.shortReview.trim() ? '있음' : '없음'}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">상세 감상</span>
              <strong>{work.review.trim() ? '있음' : '없음'}</strong>
            </div>
          </div>

          {actions && <div className="button-row">{actions}</div>}
        </div>
      </div>

      <section className="detail-review-grid">
        <ReviewSection
          body={work.shortReview}
          collapsedLabel="한줄평 펼치기"
          emptyCopy="아직 남긴 한줄평이 없습니다."
          expandedLabel="한줄평 접기"
          eyebrow="감상"
          previewMaxLength={72}
          previewFallback="짧게 남기는 감상은 아직 없습니다."
          title="한줄평"
        />
        <ReviewSection
          body={work.review}
          collapsedLabel="상세 감상 펼치기"
          emptyCopy="아직 남긴 상세 감상이 없습니다."
          expandedLabel="상세 감상 접기"
          eyebrow="리뷰"
          previewMaxLength={42}
          previewFallback="상세 감상은 접어두고 필요할 때 펼쳐보는 구조로 준비했습니다."
          title="상세 감상"
        />
      </section>

      <div className="detail-grid detail-grid--work">
        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">기록 요약</p>
            <h3 className="section-title">내 기록 정보</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>현재 상태</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>별점</dt>
              <dd>{work.rating === null ? '아직 안 매김' : `${work.rating.toFixed(1)}점`}</dd>
            </div>
            <div>
              <dt>티어</dt>
              <dd>{tierLabel}</dd>
            </div>
            <div>
              <dt>즐겨찾기</dt>
              <dd>{work.favorite ? '등록함' : '없음'}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">작품 소개</p>
            <h3 className="section-title">간단한 소개</h3>
          </div>
          <p className="detail-body-copy">
            {work.description || '작품 소개가 아직 없습니다.'}
          </p>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">작품 정보</p>
            <h3 className="section-title">기본 메타데이터</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>작가·제작자</dt>
              <dd>{work.author || '미입력'}</dd>
            </div>
            <div>
              <dt>장르</dt>
              <dd>{work.genres.length > 0 ? work.genres.join(', ') : '없음'}</dd>
            </div>
            <div>
              <dt>유형</dt>
              <dd>{typeLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="detail-section">
          <div className="section-heading">
            <p className="section-kicker">저장 정보</p>
            <h3 className="section-title">저장 및 동기화</h3>
          </div>
          <dl className="detail-list detail-list--columns">
            <div>
              <dt>동기화 상태</dt>
              <dd>{syncLabel}</dd>
            </div>
            <div>
              <dt>추가한 날</dt>
              <dd>{formatWorkDateTime(work.createdAt)}</dd>
            </div>
            <div>
              <dt>수정한 날</dt>
              <dd>{formatWorkDateTime(work.updatedAt)}</dd>
            </div>
            <div>
              <dt>서버 버전</dt>
              <dd>{work.serverVersion}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
