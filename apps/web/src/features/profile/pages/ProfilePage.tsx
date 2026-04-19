import { Link, useNavigate } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
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

export function ProfilePage() {
  const navigate = useNavigate();
  const { mode, signOut, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="stack">
      <PageHero
        description={
          isAuthenticated
            ? '계정, 동기화, 설정과 앞으로 공개 프로필로 이어질 구조를 여기서 관리합니다.'
            : '프로필 탭은 계정과 동기화, 설정을 모으는 공간입니다. 지금은 게스트 모드로 이 기기에만 저장됩니다.'
        }
        eyebrow="프로필"
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
        title={isAuthenticated ? '내 프로필' : '프로필과 계정'}
      />

      <section className="profile-grid">
        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">계정</p>
            <h2 className="section-title">
              {isAuthenticated ? '로그인된 계정' : '게스트 모드'}
            </h2>
            <p className="section-description">
              {isAuthenticated
                ? `${user?.email ?? '계정'}으로 사용 중입니다.`
                : '로그인하지 않아도 이 기기에 기록할 수 있지만, 동기화는 계정 모드에서만 사용할 수 있습니다.'}
            </p>
          </div>

          <div className="button-row">
            {isAuthenticated ? (
              <button onClick={() => void handleSignOut()} type="button">
                로그아웃
              </button>
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
              대기 중인 변경과 충돌 여부를 프로필 안에서 확인하고 수동 동기화를
              실행합니다.
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
            <Link className="secondary-link" to="/profile/sync">
              동기화 열기
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">설정</p>
            <h2 className="section-title">계정·테마·환경 설정</h2>
            <p className="section-description">
              설정은 프로필 하위에서 관리합니다. 이번 단계에서는 구조와 진입만
              먼저 정리합니다.
            </p>
          </div>

          <div className="button-row">
            <Link className="secondary-link" to="/profile/settings">
              설정 열기
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">공개 프로필</p>
            <h2 className="section-title">취향 소개 공간</h2>
            <p className="section-description">
              앞으로는 대표 작품, 공개 티어 보드, 요약 소개가 이 자리에서
              연결됩니다. 지금은 구조만 먼저 확보합니다.
            </p>
          </div>

          <div className="badge-row">
            <span className="badge">대표 작품</span>
            <span className="badge">공개 리스트</span>
            <span className="badge">티어 보드</span>
          </div>
        </article>
      </section>
    </div>
  );
}
