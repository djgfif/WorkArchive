import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="layout-shell layout-shell--auth">
      <div aria-hidden="true" className="layout-backdrop layout-backdrop--north" />
      <div aria-hidden="true" className="layout-backdrop layout-backdrop--west" />

      <div className="layout-frame layout-frame--auth">
        <section className="auth-layout-shell">
          <div className="auth-layout-spotlight">
            <Link className="brand-link" to="/">
              <span aria-hidden="true" className="brand-mark">
                WA
              </span>
              <div className="brand-copy">
                <span className="brand-kicker">취향 아카이브 서비스</span>
                <span className="brand-heading">워크 아카이브</span>
              </div>
            </Link>

            <div className="stack auth-layout-copy">
              <p className="eyebrow">계정</p>
              <h1 className="page-title">기록은 바로 시작하고, 계정은 필요할 때 연결합니다</h1>
              <p className="body-copy">
                게스트로 가볍게 시작해도 되고, 로그인하면 기록을 이어서 보고 동기화까지
                연결할 수 있습니다.
              </p>
            </div>

            <div className="auth-layout-feature-list">
              <article className="auth-layout-feature-card">
                <span className="mode-badge">로컬 우선</span>
                <h2 className="section-title">지금 바로 기록 가능</h2>
                <p className="muted-copy">
                  계정이 없어도 이 기기에서 바로 내 아카이브를 시작할 수 있습니다.
                </p>
              </article>

              <article className="auth-layout-feature-card">
                <span className="mode-badge">계정 확장</span>
                <h2 className="section-title">로그인하면 이어서 관리</h2>
                <p className="muted-copy">
                  동기화와 계정 기반 관리 흐름은 인증 이후에 자연스럽게 이어집니다.
                </p>
              </article>
            </div>

            <div className="button-row">
              <Link className="secondary-link" to="/">
                홈으로 돌아가기
              </Link>
              <Link className="secondary-link" to="/works">
                작품 둘러보기
              </Link>
            </div>
          </div>

          <div className="auth-layout-content">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
