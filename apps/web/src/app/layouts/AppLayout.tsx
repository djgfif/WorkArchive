import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthSession } from '../../features/auth/hooks/useAuthSession';

export function AppLayout() {
  const navigate = useNavigate();
  const { isLoading, mode, signOut, user } = useAuthSession();

  async function handleSignOut() {
    await signOut();
    navigate('/works');
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="panel app-header">
          <div className="app-header-main">
            <p className="eyebrow">
              {mode === 'authenticated' ? 'Account Archive' : 'Guest Local Mode'}
            </p>
            <Link className="brand-link" to="/works">
              <h1>Work Archive</h1>
            </Link>
            <p className="body-copy">
              {mode === 'authenticated'
                ? 'You are signed in, but this device still writes to IndexedDB first. Manual sync moves your current account-local archive between this browser and the API.'
                : 'Track works locally in IndexedDB with no account required. Guest mode stays device-local until you explicitly sign in.'}
            </p>
          </div>

          <div className="app-header-actions">
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

            <div className="session-block">
              <div className="session-summary">
                <span className="mode-badge">
                  {mode === 'authenticated' ? 'Signed in' : 'Guest mode'}
                </span>
                <p className="muted-copy">
                  {mode === 'authenticated'
                    ? user?.email
                    : 'Local-only archive on this device'}
                </p>
              </div>

              <div className="button-row">
                {mode === 'authenticated' ? (
                  <button onClick={() => void handleSignOut()} type="button">
                    Sign out
                  </button>
                ) : (
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
                  Add work
                </Link>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="panel stack">
            <p className="eyebrow">Loading Session</p>
            <h2 className="section-title">Opening the correct local archive</h2>
            <p className="muted-copy">
              Checking the current session and selecting the matching IndexedDB
              workspace for this device.
            </p>
          </section>
        ) : (
          <Outlet />
        )}
      </div>
    </main>
  );
}
