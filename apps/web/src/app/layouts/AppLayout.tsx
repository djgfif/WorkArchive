import { Link, NavLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="panel app-header">
          <div className="app-header-main">
            <p className="eyebrow">Local-First Archive</p>
            <Link className="brand-link" to="/works">
              <h1>Work Archive</h1>
            </Link>
            <p className="body-copy">
              Track works locally in IndexedDB. Changes persist immediately and
              the UI reads straight from the local database.
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
            </nav>

            <Link className="primary-link" to="/works/new">
              Add work
            </Link>
          </div>
        </header>

        <Outlet />
      </div>
    </main>
  );
}
