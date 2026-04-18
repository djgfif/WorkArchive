import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

export function AppLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/works');
  }

  return (
    <main className="app-shell">
      <div aria-hidden="true" className="app-shell-glow" />
      <div className="app-frame">
        <header className="panel shell-header">
          <div className="shell-topbar">
            <Link className="brand-link" to="/works">
              <span aria-hidden="true" className="brand-mark">
                WA
              </span>
              <div className="brand-copy">
                <span className="brand-kicker">취향 기록 서비스</span>
                <h1>워크 아카이브</h1>
              </div>
            </Link>

            <div className="button-row shell-topbar-actions">
              {!isAuthenticated && (
                <>
                  <Link className="secondary-link" to="/auth/login">
                    로그인
                  </Link>
                  <Link className="secondary-link" to="/auth/register">
                    회원가입
                  </Link>
                </>
              )}
              <Link className="primary-link" to="/works/new">
                작품 추가
              </Link>
            </div>
          </div>

          <div className="shell-overview">
            <div className="shell-summary">
              <p className="eyebrow">프리미엄 다크 아카이브</p>
              <p className="shell-title">
                읽고 보고 좋아한 작품을 한곳에 차분하게 정리해보세요.
              </p>
              <p className="body-copy">
                빠르게 기록하고, 나중에는 보기 좋게 다시 찾을 수 있습니다.
              </p>
            </div>

            <nav aria-label="주요 메뉴" className="app-nav">
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/works"
              >
                라이브러리
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/sync"
              >
                동기화
              </NavLink>
            </nav>

            <div className="session-card">
              <div className="session-copy">
                <span className="mode-badge">
                  {isAuthenticated ? '로그인됨' : '게스트 모드'}
                </span>
                <h2 className="session-title">
                  {isAuthenticated ? '계정으로 사용 중' : '이 기기에 저장 중'}
                </h2>
                <p className="muted-copy">
                  {isAuthenticated
                    ? user?.email
                    : '로그인하지 않아도 이 기기에 기록을 저장할 수 있습니다.'}
                </p>
              </div>

              <div className="button-row session-actions">
                {isAuthenticated ? (
                  <button onClick={() => void handleSignOut()} type="button">
                    로그아웃
                  </button>
                ) : (
                  <Link className="secondary-link" to="/auth/login">
                    로그인하고 이어서 사용하기
                  </Link>
                )}
                <Link className="secondary-link" to="/sync">
                  동기화 상태
                </Link>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="panel stack loading-panel">
            <p className="eyebrow">불러오는 중</p>
            <h2 className="section-title">워크 아카이브를 불러오고 있습니다</h2>
            <p className="muted-copy">잠시만 기다려주세요.</p>
          </section>
        ) : (
          <div className="app-content">
            <Outlet />
          </div>
        )}
      </div>
    </main>
  );
}
