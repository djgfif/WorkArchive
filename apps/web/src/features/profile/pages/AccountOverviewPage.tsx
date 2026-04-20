import { Link } from 'react-router-dom';

import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { useSyncDashboard } from '../../sync/hooks/useSyncDashboard';
import { useWorksOverview } from '../../works/hooks/useWorksOverview';
import { formatWorkDateTime } from '../../works/utils/work-options';

function formatOptionalDate(value: string | null, fallback = '아직 없음') {
  return value ? formatWorkDateTime(value) : fallback;
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

export function AccountOverviewPage() {
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';

  return (
    <AccountPageTemplate
      actions={
        <Link className="secondary-link" to="/profile">
          프로필 보기
        </Link>
      }
      description={
        isAuthenticated
          ? '동기화, 계정 상태, 설정 진입을 한 곳에 모아 관리하는 계정 전용 영역입니다.'
          : '지금은 게스트 모드입니다. 로그인하면 계정 기반 동기화와 설정을 이곳에서 관리할 수 있습니다.'
      }
      eyebrow="계정 홈"
      meta={
        <>
          <div className="stat-pill">
            <span className="stat-pill-value">{totalCount}</span>
            <span className="stat-pill-label">기록한 작품</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{completedCount}</span>
            <span className="stat-pill-label">완료</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{formatAverageRating(averageRating)}</span>
            <span className="stat-pill-label">평균 별점</span>
          </div>
        </>
      }
      title={isAuthenticated ? '계정 센터' : '계정 안내'}
    >
      <section className="profile-grid">
        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">계정 상태</p>
            <h2 className="section-title">
              {isAuthenticated ? '로그인된 계정' : '게스트 모드'}
            </h2>
            <p className="section-description">
              {isAuthenticated
                ? `${user?.email ?? '계정'}으로 사용 중입니다. 이 기기와 계정 기록을 연결해 관리합니다.`
                : '게스트 모드에서는 이 기기에만 저장됩니다. 로그인하면 계정 기반 아카이브와 동기화 흐름을 열 수 있습니다.'}
            </p>
          </div>

          <div className="button-row">
            {isAuthenticated ? (
              <Link className="secondary-link" to="/account/settings">
                계정 설정 보기
              </Link>
            ) : (
              <>
                <Link className="secondary-link" to="/auth/login">
                  로그인
                </Link>
                <Link className="secondary-link" to="/auth/register">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">동기화</p>
            <h2 className="section-title">계정 보조 기능</h2>
            <p className="section-description">
              대기열, 충돌, 최근 동기화 상태를 이 영역에서 계속 관리합니다.
            </p>
          </div>

          <dl className="detail-list detail-list--columns">
            <div>
              <dt>대기 중</dt>
              <dd>{queueItems.length}건</dd>
            </div>
            <div>
              <dt>충돌</dt>
              <dd>{conflictWorks.length}건</dd>
            </div>
            <div>
              <dt>최근 동기화</dt>
              <dd>{formatOptionalDate(lastSuccessfulPullAt)}</dd>
            </div>
          </dl>

          <div className="button-row">
            <Link className="secondary-link" to="/account/sync">
              동기화 열기
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">설정</p>
            <h2 className="section-title">계정·테마·공개 범위</h2>
            <p className="section-description">
              서비스 경험을 바꾸는 설정과 공개 범위 정책은 이 영역에서 점진적으로 확장합니다.
            </p>
          </div>

          <div className="badge-row">
            <span className="badge">테마</span>
            <span className="badge">공개 범위</span>
            <span className="badge">계정 정보</span>
          </div>

          <div className="button-row">
            <Link className="secondary-link" to="/account/settings">
              설정 열기
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">프로필 연결</p>
            <h2 className="section-title">공개 프로필과 연결 준비</h2>
            <p className="section-description">
              프로필은 메인 제품 목적지로 남기고, 계정 센터에서는 공개 범위와 연결 정책을 관리합니다.
            </p>
          </div>

          <div className="button-row">
            <Link className="secondary-link" to="/profile">
              프로필 보기
            </Link>
          </div>
        </article>
      </section>
    </AccountPageTemplate>
  );
}
