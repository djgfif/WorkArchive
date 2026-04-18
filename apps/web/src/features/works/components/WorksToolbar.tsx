import { Link } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import type { WorksListQuery } from '../utils/query-works';
import {
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface WorksToolbarProps {
  filteredCount: number;
  isLoading: boolean;
  onClearFilters: () => void;
  onQueryChange: (query: WorksListQuery) => void;
  query: WorksListQuery;
  totalActiveCount: number;
}

export function WorksToolbar({
  filteredCount,
  isLoading,
  onClearFilters,
  onQueryChange,
  query,
  totalActiveCount,
}: WorksToolbarProps) {
  let countSummary = 'Loading your archive...';

  if (!isLoading) {
    if (totalActiveCount === 0) {
      countSummary = 'No works yet. Start building your library with the first entry.';
    } else if (filteredCount === totalActiveCount) {
      countSummary = `Showing all ${totalActiveCount} saved ${
        totalActiveCount === 1 ? 'work' : 'works'
      } in your archive.`;
    } else {
      countSummary = `Showing ${filteredCount} of ${totalActiveCount} saved ${
        totalActiveCount === 1 ? 'work' : 'works'
      } in your archive.`;
    }
  }

  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    query.status !== 'all' ||
    query.type !== 'all' ||
    query.sortBy !== 'updatedAt';

  return (
    <section className="stack">
      <PageHero
        actions={
          <>
            {hasActiveFilters && (
              <button onClick={onClearFilters} type="button">
                Reset view
              </button>
            )}
            <Link className="primary-link" to="/works/new">
              Add work
            </Link>
          </>
        }
        description="Browse, filter, and revisit your archive without losing focus on the work itself."
        eyebrow="Library"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{totalActiveCount}</span>
              <span className="stat-pill-label">Saved works</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{filteredCount}</span>
              <span className="stat-pill-label">In view</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">
                {workSortOptions.find((option) => option.value === query.sortBy)?.label}
              </span>
              <span className="stat-pill-label">Sorting</span>
            </div>
          </>
        }
        title="Your library"
      />

      <section className="panel stack toolbar-panel">
        <div className="toolbar-header">
          <div>
            <h3 className="section-title">Refine the view</h3>
            <p className="muted-copy">{countSummary}</p>
          </div>
        </div>

        <label className="field search-field" htmlFor="searchTerm">
          <span>Search library</span>
          <input
            id="searchTerm"
            name="searchTerm"
            onChange={(event) =>
              onQueryChange({ ...query, searchTerm: event.target.value })
            }
            placeholder="Search by title or creator"
            value={query.searchTerm}
          />
        </label>

        <div className="toolbar-grid">
          <label className="field" htmlFor="typeFilter">
            <span>Type</span>
            <select
              id="typeFilter"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  type: event.target.value as WorksListQuery['type'],
                })
              }
              value={query.type}
            >
              <option value="all">All types</option>
              {workTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="statusFilter">
            <span>Status</span>
            <select
              id="statusFilter"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  status: event.target.value as WorksListQuery['status'],
                })
              }
              value={query.status}
            >
              <option value="all">All statuses</option>
              {workStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="sortBy">
            <span>Sort</span>
            <select
              id="sortBy"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  sortBy: event.target.value as WorksListQuery['sortBy'],
                })
              }
              value={query.sortBy}
            >
              {workSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </section>
  );
}
