import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

const mainNavigationItems = [
  { label: '홈', to: '/' },
  { label: '작품', to: '/works' },
  { label: '티어 보드', to: '/tier-boards' },
  { label: '인사이트', to: '/insights' },
  { label: '커뮤니티', to: '/community' },
  { label: '프로필', to: '/profile' },
] as const;

export function MainProductLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const isAuthenticated = mode === 'authenticated';

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <main className="layout-shell layout-shell--product">
      <div aria-hidden="true" className="layout-backdrop layout-backdrop--north" />
      <div aria-hidden="true" className="layout-backdrop layout-backdrop--east" />

      <div className="layout-frame layout-frame--product">
        <header className="product-layout">
          <section className="panel product-layout-shell">
            <div className="product-layout-topbar">
              <Link className="brand-link" to="/">
                <span aria-hidden="true" className="brand-mark">
                  WA
                </span>
                <div className="brand-copy">
                  <span className="brand-kicker">개인 취향 아카이브</span>
                  <span className="brand-heading">워크 아카이브</span>
                </div>
              </Link>

              <div className="button-row product-layout-actions">
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

            <div className="product-layout-nav-row">
              <nav aria-label="주요 메뉴" className="app-nav app-nav--primary">
                {mainNavigationItems.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      isActive ? 'app-nav-link active' : 'app-nav-link'
                    }
                    end={item.to === '/'}
                    key={item.to}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <section className="session-card session-card--compact">
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
                <div className="button-row">
                  <Link className="secondary-link" to="/profile">
                    프로필
                  </Link>
                  <Link className="secondary-link" to="/account">
                    계정 센터
                  </Link>
                </div>
              </section>
            </div>
          </section>
        </header>

        {isLoading ? (
          <section className="panel stack loading-panel">
            <p className="eyebrow">불러오는 중</p>
            <h1 className="section-title">워크 아카이브를 불러오고 있습니다</h1>
            <p className="muted-copy">잠시만 기다려주세요.</p>
          </section>
        ) : (
          <div className="layout-outlet layout-outlet--product">
            <Outlet />
          </div>
        )}
      </div>
    </main>
  );
}
