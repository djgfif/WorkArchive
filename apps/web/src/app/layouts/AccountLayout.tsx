import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

const accountNavigationItems = [
  { label: '계정 홈', to: '/account' },
  { label: '동기화', to: '/account/sync' },
  { label: '설정', to: '/account/settings' },
] as const;

export function AccountLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--account">
      <div aria-hidden="true" className="layout-backdrop layout-backdrop--east" />
      <div className="layout-frame layout-frame--account">
        <section className="account-layout">
          <aside className="panel account-layout-sidebar">
            <div className="stack">
              <Link className="brand-link" to="/">
                <span aria-hidden="true" className="brand-mark">
                  WA
                </span>
                <div className="brand-copy">
                  <span className="brand-kicker">계정 센터</span>
                  <span className="brand-heading">관리 맥락</span>
                </div>
              </Link>

              <div className="stack">
                <span className="mode-badge">
                  {isAuthenticated ? '로그인됨' : '게스트 모드'}
                </span>
                <h1 className="section-title">
                  {isAuthenticated ? '계정과 동기화 설정' : '계정 기능 안내'}
                </h1>
                <p className="muted-copy">
                  {isAuthenticated
                    ? `${user?.email ?? '계정'}으로 사용하는 관리 화면입니다.`
                    : '로그인하면 동기화와 계정 설정을 이 영역에서 관리할 수 있습니다.'}
                </p>
              </div>
            </div>

            <nav aria-label="계정 메뉴" className="account-nav">
              {accountNavigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    isActive ? 'account-nav-link active' : 'account-nav-link'
                  }
                  end={item.to === '/account'}
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="stack account-layout-sidebar-footer">
              <Link className="secondary-link" to="/profile">
                프로필로 돌아가기
              </Link>
              {isAuthenticated ? (
                <button onClick={() => void handleSignOut()} type="button">
                  로그아웃
                </button>
              ) : (
                <Link className="secondary-link" to="/auth/login">
                  로그인
                </Link>
              )}
            </div>
          </aside>

          <div className="layout-outlet layout-outlet--account">
            {isLoading ? (
              <section className="panel stack loading-panel">
                <p className="eyebrow">불러오는 중</p>
                <h2 className="section-title">계정 설정을 준비하고 있습니다</h2>
                <p className="muted-copy">잠시만 기다려주세요.</p>
              </section>
            ) : (
              <Outlet />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
