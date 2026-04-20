import { Outlet } from 'react-router-dom';

export function MinimalLayout() {
  return (
    <main className="layout-shell layout-shell--minimal">
      <div className="layout-frame layout-frame--minimal">
        <div className="layout-outlet layout-outlet--minimal">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
