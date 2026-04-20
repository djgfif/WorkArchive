import { Link } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
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
  const { mode, user } = useAuthSession();
  const { averageRating, completedCount, totalCount } = useWorksOverview();
  const { conflictWorks, lastSuccessfulPullAt, queueItems } = useSyncDashboard();
  const isAuthenticated = mode === 'authenticated';

  return (
    <DetailPageTemplate>
      <PageHero
        actions={
          <>
            <Link className="secondary-link" to="/account">
              계정 센터
            </Link>
            <Link className="secondary-link" to="/works">
              작품 보기
            </Link>
          </>
        }
        description={
          isAuthenticated
            ? '개인 취향 아카이브의 얼굴이 되는 프로필 화면입니다. 계정 관리와 동기화는 별도 계정 센터로 분리했습니다.'
            : '지금은 게스트 모드이지만, 프로필은 앞으로 공개 취향 아카이브로 확장될 메인 목적지입니다.'
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
        title={isAuthenticated ? '내 프로필' : '내 아카이브 프로필'}
      />

      <section className="profile-grid">
        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">프로필 소개</p>
            <h2 className="section-title">
              {isAuthenticated ? '내 취향 아카이브' : '게스트 프로필 미리보기'}
            </h2>
            <p className="section-description">
              {isAuthenticated
                ? `${user?.email ?? '계정'} 기준으로 기록을 모으고 있습니다. 대표 작품, 공개 소개, 티어 보드가 앞으로 이 구조에 연결됩니다.`
                : '로그인하지 않아도 기록은 시작할 수 있습니다. 계정을 만들면 이 흐름을 계정 프로필로 자연스럽게 이어갈 수 있습니다.'}
            </p>
          </div>

          <div className="badge-row">
            <span className="badge">대표 작품</span>
            <span className="badge">공개 소개</span>
            <span className="badge">취향 요약</span>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">기록 요약</p>
            <h2 className="section-title">지금 보이는 아카이브 상태</h2>
            <p className="section-description">
              프로필은 기록량과 감상 흐름을 보여주는 목적지입니다. 관리 동작은 계정 센터에서 이어집니다.
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
        </article>

        <article className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">계정 센터</p>
            <h2 className="section-title">관리 기능은 따로 분리했습니다</h2>
            <p className="section-description">
              동기화, 설정, 공개 범위는 메인 프로필 흐름과 분리된 관리 영역에서 차분하게 다룹니다.
            </p>
          </div>

          <div className="button-row">
            <Link className="secondary-link" to="/account">
              계정 센터 열기
            </Link>
            <Link className="secondary-link" to="/account/sync">
              동기화 바로가기
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
    </DetailPageTemplate>
  );
}
