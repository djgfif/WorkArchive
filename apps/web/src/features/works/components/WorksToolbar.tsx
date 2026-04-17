import type { WorksListQuery } from '../utils/query-works';
import {
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface WorksToolbarProps {
  onQueryChange: (query: WorksListQuery) => void;
  query: WorksListQuery;
  totalCount: number;
}

export function WorksToolbar({
  onQueryChange,
  query,
  totalCount,
}: WorksToolbarProps) {
  return (
    <section className="panel stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2 className="section-title">Browse your local archive</h2>
          <p className="muted-copy">
            {totalCount} active {totalCount === 1 ? 'work' : 'works'} stored in
            IndexedDB.
          </p>
        </div>
      </div>

      <div className="toolbar-grid">
        <label className="field" htmlFor="searchTerm">
          <span>Search</span>
          <input
            id="searchTerm"
            name="searchTerm"
            onChange={(event) =>
              onQueryChange({ ...query, searchTerm: event.target.value })
            }
            placeholder="Search title or author"
            value={query.searchTerm}
          />
        </label>

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
  );
}
