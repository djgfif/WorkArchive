import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="panel stack">
      <p className="eyebrow">찾을 수 없음</p>
      <h1 className="page-title">페이지를 찾을 수 없습니다.</h1>
      <p className="body-copy">
        홈으로 돌아가 다시 시작해보세요.
      </p>
      <div className="button-row">
        <Link className="primary-link" to="/">
          홈으로 이동
        </Link>
      </div>
    </section>
  );
}
