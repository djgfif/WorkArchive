import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../works/utils/work-options';

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { mode, user } = useAuthSession();
  const {
    averageRating,
    completedCount,
    deletedCount,
    error,
    inProgressCount,
    isLoading,
    pausedOrDroppedCount,
    recentWorks,
    totalCount,
  } = useWorksOverview();
  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';
  const leadRecentWork = recentWorks[0] ?? null;

  const primaryAction =
    totalCount === 0
      ? {
          description: '아직 비어 있으니 첫 작품부터 가볍게 등록해보세요.',
          label: '첫 작품 추가',
          to: '/works/new',
        }
      : leadRecentWork
        ? {
            description: `${leadRecentWork.title} 기록을 이어서 확인합니다.`,
            label: '최근 기록 이어보기',
            to: `/works/${leadRecentWork.id}`,
          }
        : {
            description: '작품 탭에서 최근 기록과 상태를 다시 정리할 수 있습니다.',
            label: '작품 정리하기',
            to: '/works',
          };
  const managementAction =
    deletedCount > 0
      ? {
          description: `숨겨둔 작품 ${deletedCount}개를 확인하고 필요하면 복원할 수 있습니다.`,
          label: '휴지통 확인',
          to: '/works?scope=trash',
        }
      : inProgressCount > 0
        ? {
            description: `보는 중인 작품 ${inProgressCount}개를 이어서 정리합니다.`,
            label: '보는 중 작품 정리',
            to: '/works?status=in_progress',
          }
        : {
            description: '상태와 별점을 빠르게 바꾸면서 전체 기록을 정리합니다.',
            label: '작품 목록 관리',
            to: '/works',
          };

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    navigate(
      normalizedSearchTerm ? `/works?q=${encodeURIComponent(normalizedSearchTerm)}` : '/works',
    );
  }

  return (
    <div className="stack">
      <section className="panel home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">홈</p>
          <h2 className="page-title">오늘 기록할 작품을 바로 시작해보세요</h2>
          <p className="body-copy">
            검색, 빠른 추가, 최근 기록 복귀까지 한 화면에서 바로 이어집니다.
          </p>
        </div>

        <form className="home-search-form" onSubmit={handleSearchSubmit}>
          <label className="home-search-input" htmlFor="homeSearch">
            <span className="sr-only">홈 검색</span>
            <input
              id="homeSearch"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="제목이나 작가로 작품 찾기"
              value={searchTerm}
            />
          </label>
          <button type="submit">작품 찾기</button>
          <Link className="secondary-link" to="/works/new">
            빠른 추가
          </Link>
        </form>

        <div className="home-hero-hint">
          <span className="badge">검색에서 시작</span>
          <span className="badge">작품 추가 상시 노출</span>
          <span className="badge">최근 기록 바로 이어보기</span>
        </div>
      </section>

      <section className="home-overview-grid">
        <article className="panel stack home-welcome-panel">
          <div className="section-heading">
            <p className="section-kicker">환영</p>
            <h2 className="section-title">
              {isAuthenticated ? '다시 이어서 기록해볼까요?' : '바로 내 아카이브를 시작해보세요'}
            </h2>
            <p className="section-description">
              {isAuthenticated
                ? `${user?.email ?? '계정'}으로 기록 중입니다. 지금 필요한 관리 작업만 바로 고를 수 있도록 정리했습니다.`
                : '게스트 모드에서도 바로 저장됩니다. 기록이 쌓이면 계정으로 이어가도 됩니다.'}
            </p>
          </div>

          <div className="home-next-actions">
            <Link className="home-next-card home-next-card--primary" to={primaryAction.to}>
              <span className="mode-badge">지금 하면 좋은 일</span>
              <h3 className="section-title">{primaryAction.label}</h3>
              <p className="muted-copy">{primaryAction.description}</p>
            </Link>

            <Link className="home-next-card" to={managementAction.to}>
              <span className="badge">관리 흐름</span>
              <h3 className="section-title">{managementAction.label}</h3>
              <p className="muted-copy">
                {managementAction.description}
              </p>
            </Link>

            <Link className="home-next-card" to="/works/new">
              <span className="badge">빠른 추가</span>
              <h3 className="section-title">작품을 바로 등록</h3>
              <p className="muted-copy">
                검색에서 후보를 고르고 개인 기록만 입력해 저장할 수 있습니다.
              </p>
            </Link>
          </div>
        </article>

        <section className="panel stack home-stats-panel">
          <div className="section-heading">
            <p className="section-kicker">통계 요약</p>
            <h2 className="section-title">내 기록 한눈에 보기</h2>
            <p className="section-description">
              기록의 양과 감상 흐름을 가장 먼저 확인할 수 있는 4개 지표만 남겼습니다.
            </p>
          </div>

          {error && (
            <div aria-live="polite" className="error-banner" role="alert">
              {error}
            </div>
          )}

          {!error && (
            <div className="home-stat-grid">
              <Link className="home-stat-card home-stat-card--accent" to="/works">
                <span className="home-stat-label">총 기록 수</span>
                <strong>{isLoading ? '...' : `${totalCount}개`}</strong>
                <p className="muted-copy">
                  {isLoading
                    ? '불러오는 중'
                    : totalCount === 0
                      ? '아직 비어 있습니다'
                      : '전체 아카이브 열기'}
                </p>
              </Link>
              <Link className="home-stat-card" to="/works?sort=rating">
                <span className="home-stat-label">평균 별점</span>
                <strong>{isLoading ? '...' : formatAverageRating(averageRating)}</strong>
                <p className="muted-copy">별점순으로 다시 보기</p>
              </Link>
              <Link className="home-stat-card" to="/works?status=completed">
                <span className="home-stat-label">완주 작품 수</span>
                <strong>{isLoading ? '...' : `${completedCount}개`}</strong>
                <p className="muted-copy">완료한 기록만 보기</p>
              </Link>
              <Link className="home-stat-card" to="/works">
                <span className="home-stat-label">하차·보류 수</span>
                <strong>{isLoading ? '...' : `${pausedOrDroppedCount}개`}</strong>
                <p className="muted-copy">멈춘 기록 다시 정리</p>
              </Link>
            </div>
          )}
        </section>
      </section>

      <section className="panel stack">
        <div className="home-section-header">
          <div>
            <p className="eyebrow">최근 기록</p>
            <h2 className="section-title">최근 남긴 작품 6개</h2>
          </div>
          <div className="button-row">
            <Link className="secondary-link" to="/works">
              작품 전체 보기
            </Link>
          </div>
        </div>

        {error && (
          <p className="muted-copy">
            최근 기록을 불러오지 못했습니다. 작품 탭에서 다시 확인해주세요.
          </p>
        )}

        {!error && isLoading && (
          <p className="muted-copy">최근 기록을 불러오는 중입니다.</p>
        )}

        {!error && !isLoading && recentWorks.length === 0 && (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-state-art">
              <span>WA</span>
            </div>
            <div className="stack">
              <h3 className="section-title">아직 최근 기록이 없습니다.</h3>
              <p className="muted-copy">
                첫 작품을 추가하면 홈에서 최근 기록과 요약 통계를 바로 볼 수
                있습니다.
              </p>
              <div className="button-row">
                <Link className="primary-link" to="/works/new">
                  작품 추가
                </Link>
              </div>
            </div>
          </div>
        )}

        {!error && !isLoading && recentWorks.length > 0 && (
          <div className="home-recent-grid">
            {recentWorks.map((work, index) => (
              <Link
                className={
                  index === 0
                    ? 'home-recent-card home-recent-card--featured'
                    : 'home-recent-card'
                }
                key={work.id}
                to={`/works/${work.id}`}
              >
                <ArtworkPoster
                  thumbnailUrl={work.thumbnailUrl}
                  title={work.title}
                  typeLabel={getWorkTypeLabel(work.type)}
                  variant="row"
                />

                <div className="home-recent-copy">
                  <div className="home-recent-meta">
                    {index === 0 && <span className="mode-badge">최근 작업</span>}
                    <span className="badge">{getWorkTypeLabel(work.type)}</span>
                    <span className="badge">{getWorkStatusLabel(work.status)}</span>
                    <span className="badge">
                      {work.rating === null ? '미평가' : `${work.rating}점`}
                    </span>
                  </div>

                  <div className="stack">
                    <h3 className="card-title">{work.title}</h3>
                    <p className="muted-copy">
                      {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
                      {formatWorkUpdatedAt(work.updatedAt)}
                    </p>
                  </div>

                  <p className="card-summary">
                    {work.shortReview || work.description || '아직 남긴 메모가 없습니다.'}
                  </p>

                  <div className="home-recent-footer">
                    <span className="muted-copy">상세 보기</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
