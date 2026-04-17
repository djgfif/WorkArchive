import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="panel stack">
      <p className="eyebrow">Not Found</p>
      <h1 className="page-title">This page does not exist.</h1>
      <p className="body-copy">
        Try going back to the works library and continue from there.
      </p>
      <div className="button-row">
        <Link className="primary-link" to="/works">
          Go to library
        </Link>
      </div>
    </section>
  );
}
