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
                <span className="brand-kicker">Personal archive</span>
                <h1>Work Archive</h1>
              </div>
            </Link>

            <div className="button-row shell-topbar-actions">
              {!isAuthenticated && (
                <>
                  <Link className="secondary-link" to="/auth/login">
                    Sign in
                  </Link>
                  <Link className="secondary-link" to="/auth/register">
                    Sign up
                  </Link>
                </>
              )}
              <Link className="primary-link" to="/works/new">
                Quick add
              </Link>
            </div>
          </div>

          <div className="shell-overview">
            <div className="shell-summary">
              <p className="eyebrow">Premium Dark Archive</p>
              <p className="shell-title">
                Keep the titles you read, watch, and revisit in one polished
                personal library.
              </p>
              <p className="body-copy">
                Fast enough for quick capture, clean enough to browse like a
                finished product.
              </p>
            </div>

            <nav aria-label="Primary" className="app-nav">
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/works"
              >
                Library
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'app-nav-link active' : 'app-nav-link'
                }
                to="/sync"
              >
                Sync
              </NavLink>
            </nav>

            <div className="session-card">
              <div className="session-copy">
                <span className="mode-badge">
                  {isAuthenticated ? 'Signed in' : 'Guest mode'}
                </span>
                <h2 className="session-title">
                  {isAuthenticated ? 'Account archive ready' : 'Local archive ready'}
                </h2>
                <p className="muted-copy">
                  {isAuthenticated
                    ? user?.email
                    : 'Everything stays on this device until you choose to sign in.'}
                </p>
              </div>

              <div className="button-row session-actions">
                {isAuthenticated ? (
                  <button onClick={() => void handleSignOut()} type="button">
                    Sign out
                  </button>
                ) : (
                  <Link className="secondary-link" to="/auth/login">
                    Open account mode
                  </Link>
                )}
                <Link className="secondary-link" to="/sync">
                  Sync status
                </Link>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="panel stack loading-panel">
            <p className="eyebrow">Loading Session</p>
            <h2 className="section-title">Opening your archive</h2>
            <p className="muted-copy">
              Checking the active session and loading the matching workspace for
              this device.
            </p>
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
