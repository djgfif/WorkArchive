import { Link } from 'react-router-dom';
import { useState } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { useWorksList } from '../hooks/useWorksList';
import { worksService } from '../services/works.service';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import { WorksList } from '../components/WorksList';
import { WorksToolbar } from '../components/WorksToolbar';

export function WorksListPage() {
  const [query, setQuery] = useState<WorksListQuery>(DEFAULT_WORKS_LIST_QUERY);
  const [actionError, setActionError] = useState<string | null>(null);
  const { error, isLoading, works } = useWorksList(query);

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = window.confirm(
      `Soft delete "${work.title}" from the active works list?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete this work.',
      );
    }
  }

  return (
    <div className="stack">
      <WorksToolbar onQueryChange={setQuery} query={query} totalCount={works.length} />

      {actionError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      {error && (
        <section className="panel stack">
          <h2 className="section-title">Could not load the library.</h2>
          <p className="muted-copy">{error}</p>
        </section>
      )}

      {!error && isLoading && (
        <section className="panel stack">
          <h2 className="section-title">Loading works...</h2>
          <p className="muted-copy">Opening the local IndexedDB archive.</p>
        </section>
      )}

      {!error && !isLoading && works.length === 0 && (
        <section className="panel stack">
          <p className="eyebrow">Empty Library</p>
          <h2 className="section-title">No works match the current view.</h2>
          <p className="muted-copy">
            {query.searchTerm || query.type !== 'all' || query.status !== 'all'
              ? 'Clear the current search or filters, or add a new work.'
              : 'Start the archive by saving your first work locally.'}
          </p>
          <div className="button-row">
            <Link className="primary-link" to="/works/new">
              Add your first work
            </Link>
            {(query.searchTerm ||
              query.type !== 'all' ||
              query.status !== 'all') && (
              <button
                onClick={() => setQuery(DEFAULT_WORKS_LIST_QUERY)}
                type="button"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>
      )}

      {!error && !isLoading && works.length > 0 && (
        <WorksList onDelete={handleDelete} works={works} />
      )}
    </div>
  );
}
