import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';

export function WorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = window.confirm(
      `Soft delete "${work.title}" from the active works list?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      navigate('/works');
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete this work.',
      );
    }
  }

  if (error) {
    return (
      <section className="panel stack">
        <h2 className="section-title">Could not load this work.</h2>
        <p className="muted-copy">{error}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel stack">
        <h2 className="section-title">Loading work...</h2>
        <p className="muted-copy">Reading the current record from IndexedDB.</p>
      </section>
    );
  }

  if (!work) {
    return (
      <section className="panel stack">
        <p className="eyebrow">Not Found</p>
        <h2 className="section-title">This work is not available.</h2>
        <p className="muted-copy">
          It may have been deleted or the link is no longer valid.
        </p>
        <div className="button-row">
          <Link className="primary-link" to="/works">
            Back to library
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <div className="button-row">
        <Link className="secondary-link" to="/works">
          Back to library
        </Link>
        <Link className="secondary-link" to={`/works/${work.id}/edit`}>
          Edit work
        </Link>
        <button className="danger-button" onClick={() => void handleDelete()} type="button">
          Delete
        </button>
      </div>

      {actionError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      <WorkDetailPanel work={work} />
    </div>
  );
}
