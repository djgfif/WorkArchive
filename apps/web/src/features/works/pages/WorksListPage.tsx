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
  const { error, isLoading, totalActiveCount, works } = useWorksList(query);

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
      <WorksToolbar
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={() => setQuery(DEFAULT_WORKS_LIST_QUERY)}
        onQueryChange={setQuery}
        query={query}
        totalActiveCount={totalActiveCount}
      />

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
          <h2 className="section-title">Loading your library...</h2>
          <p className="muted-copy">Opening the saved works on this device.</p>
        </section>
      )}

      {!error && !isLoading && works.length === 0 && (
        <section className="panel empty-state">
          <div aria-hidden="true" className="empty-state-art">
            <span>WA</span>
          </div>
          <div className="stack">
            <p className="eyebrow">Empty Library</p>
            <h2 className="section-title">No works match this view.</h2>
          <p className="muted-copy">
            {query.searchTerm || query.type !== 'all' || query.status !== 'all'
              ? 'Try widening the filters or start a new entry.'
              : 'Start the archive with the first title you want to keep track of.'}
          </p>
          <div className="button-row">
            <Link className="primary-link" to="/works/new">
              Add a work
            </Link>
            {(query.searchTerm ||
              query.type !== 'all' ||
              query.status !== 'all') && (
              <button
                onClick={() => setQuery(DEFAULT_WORKS_LIST_QUERY)}
                type="button"
              >
                Reset view
              </button>
            )}
          </div>
          </div>
        </section>
      )}

      {!error && !isLoading && works.length > 0 && (
        <WorksList onDelete={handleDelete} works={works} />
      )}
    </div>
  );
}
