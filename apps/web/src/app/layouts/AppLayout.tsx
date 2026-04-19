import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

export function AppLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <main className="app-shell">
      <div aria-hidden="true" className="app-shell-glow" />
      <div className="app-frame">
        <header className="panel shell-header">
          <div className="shell-topbar">
            <Link className="brand-link" to="/">
              <span aria-hidden="true" className="brand-mark">
                WA
              </span>
              <div className="brand-copy">
                <span className="brand-kicker">취향 아카이브 서비스</span>
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
              {isAuthenticated && (
                <button onClick={() => void handleSignOut()} type="button">
                  로그아웃
                </button>
              )}
              <Link className="primary-link" to="/works/new">
                작품 추가
              </Link>
            </div>
          </div>

          <div className="shell-nav-row">
            <nav aria-label="주요 메뉴" className="app-nav app-nav--primary">
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                end
                to="/"
              >
                홈
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/works"
              >
                작품
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/tier-boards"
              >
                티어 보드
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/insights"
              >
                인사이트
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/community"
              >
                커뮤니티
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/profile"
              >
                프로필
              </NavLink>
            </nav>

            <div className="session-card session-card--inline">
              <span className="mode-badge">
                {isAuthenticated ? '로그인됨' : '게스트 모드'}
              </span>
              <div className="session-copy">
                <h2 className="session-title">
                  {isAuthenticated ? '계정 아카이브 사용 중' : '로컬 아카이브 사용 중'}
                </h2>
                <p className="muted-copy">
                  {isAuthenticated
                    ? user?.email
                    : '로그인하지 않아도 이 기기에 기록을 저장할 수 있습니다.'}
                </p>
              </div>
              <Link className="secondary-link" to="/profile">
                {isAuthenticated ? '프로필' : '계정 메뉴'}
              </Link>
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
