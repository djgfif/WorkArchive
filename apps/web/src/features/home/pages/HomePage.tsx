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
    error,
    isLoading,
    pausedOrDroppedCount,
    recentWorks,
    totalCount,
  } = useWorksOverview();
  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';

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
          <h2 className="page-title">오늘 기록할 작품을 바로 찾아보세요</h2>
          <p className="body-copy">
            검색으로 작품을 찾고, 빠르게 추가하고, 최근 기록으로 바로 돌아올 수
            있습니다.
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

        <div className="badge-row">
          <span className="badge">로컬 우선 저장</span>
          <span className="badge">한국어 중심 UX</span>
          <span className="badge">작품 관리 허브</span>
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
                ? `${user?.email ?? '계정'}으로 기록을 이어서 보고 있습니다. 홈에서 추가, 탐색, 최근 기록 확인을 바로 시작할 수 있습니다.`
                : '게스트 모드에서도 이 기기에 바로 저장됩니다. 계정을 만들면 나중에 동기화까지 이어갈 수 있습니다.'}
            </p>
          </div>

          <div className="button-row">
            <Link className="secondary-link" to="/works">
              작품 둘러보기
            </Link>
            <Link
              className="secondary-link"
              to={isAuthenticated ? '/profile' : '/auth/login'}
            >
              {isAuthenticated ? '프로필 보기' : '로그인'}
            </Link>
          </div>
        </article>

        <section className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">통계 요약</p>
            <h2 className="section-title">내 기록 한눈에 보기</h2>
          </div>

          {error && (
            <div aria-live="polite" className="error-banner" role="alert">
              {error}
            </div>
          )}

          {!error && (
            <div className="home-stat-grid">
              <article className="home-stat-card">
                <span className="home-stat-label">총 기록 수</span>
                <strong>{isLoading ? '...' : `${totalCount}개`}</strong>
              </article>
              <article className="home-stat-card">
                <span className="home-stat-label">평균 별점</span>
                <strong>{isLoading ? '...' : formatAverageRating(averageRating)}</strong>
              </article>
              <article className="home-stat-card">
                <span className="home-stat-label">완주 작품 수</span>
                <strong>{isLoading ? '...' : `${completedCount}개`}</strong>
              </article>
              <article className="home-stat-card">
                <span className="home-stat-label">하차·보류 수</span>
                <strong>{isLoading ? '...' : `${pausedOrDroppedCount}개`}</strong>
              </article>
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
          <Link className="secondary-link" to="/works">
            더보기
          </Link>
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
            {recentWorks.map((work) => (
              <Link
                className="home-recent-card"
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
