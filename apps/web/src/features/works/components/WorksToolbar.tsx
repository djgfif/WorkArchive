import { Stack } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useRef, useState } from 'react';

import type { WorkStatus, WorkType } from '@work-archive/shared-types';

import type { WorksCollectionScope } from '../services/works.service';
import {
  getDefaultSortDirection,
  type WorksListQuery,
} from '../utils/query-works';
import {
  buildActiveFilterChips,
} from '../utils/works-toolbar-state';
import type { WorksViewMode } from './WorksList';
import { WorksToolbarControls } from './WorksToolbarControls';
import { AdvancedFiltersPanel } from './WorksAdvancedFiltersPanel';
import {
  ActiveFilterChips,
  MediaTypeFilter,
  TrashScopeBar,
} from './WorksToolbarFilters';

interface WorksToolbarProps {
  collectionScope: WorksCollectionScope;
  filteredCount: number;
  genreSuggestions: string[];
  onClearFilters: () => void;
  onCollectionScopeChange: (scope: WorksCollectionScope) => void;
  onQueryChange: (query: WorksListQuery) => void;
  onViewModeChange: (viewMode: WorksViewMode) => void;
  organizationContributorSuggestions: string[];
  personContributorSuggestions: string[];
  query: WorksListQuery;
  seriesSuggestions: string[];
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  totalActiveCount: number;
  totalDeletedCount: number;
  typeCounts: Record<WorkType, number>;
  viewMode: WorksViewMode;
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

export function WorksToolbar({
  collectionScope,
  filteredCount: _filteredCount,
  genreSuggestions,
  onClearFilters,
  onCollectionScopeChange,
  onQueryChange,
  onViewModeChange,
  organizationContributorSuggestions,
  personContributorSuggestions,
  query,
  seriesSuggestions,
  statusCounts,
  tagSuggestions,
  totalActiveCount,
  totalDeletedCount,
  typeCounts,
  viewMode,
}: WorksToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const defaultSortDirection = getDefaultSortDirection(query.sortBy);
  const sortDirection = query.sortDirection ?? defaultSortDirection;
  const isTrashScope = collectionScope === 'trash';
  const activeFilterChips = buildActiveFilterChips({
    defaultSortDirection,
    onQueryChange,
    query,
    sortDirection,
  });
  const hasActiveFilters = activeFilterChips.length > 0;

  useHotkeys([
    [
      'slash',
      () => {
        searchRef.current?.focus();
        searchRef.current?.select();
      },
    ],
    [
      'Escape',
      () => {
        if (query.searchTerm) {
          onQueryChange({ ...query, searchTerm: '' });
          searchRef.current?.blur();
        }
      },
    ],
    [
      'g',
      (event) => {
        if (isEditableElement(event.target)) return;
        onViewModeChange(viewMode === 'grid' ? 'list' : 'grid');
      },
    ],
    [
      'f',
      (event) => {
        if (isEditableElement(event.target)) return;
        setAdvancedOpen((opened) => !opened);
      },
    ],
  ]);

  return (
    <Stack gap="sm">
      <WorksToolbarControls
        activeFilterCount={activeFilterChips.length}
        advancedOpen={advancedOpen}
        collectionScope={collectionScope}
        hasActiveFilters={hasActiveFilters}
        isTrashScope={isTrashScope}
        onCollectionScopeChange={onCollectionScopeChange}
        onQueryChange={onQueryChange}
        onToggleAdvanced={() => setAdvancedOpen((opened) => !opened)}
        onViewModeChange={onViewModeChange}
        query={query}
        searchRef={searchRef}
        sortDirection={sortDirection}
        totalActiveCount={totalActiveCount}
        totalDeletedCount={totalDeletedCount}
        viewMode={viewMode}
      />

      {collectionScope === 'active' && (
        <MediaTypeFilter
          onChange={(type) => onQueryChange({ ...query, type })}
          totalCount={totalActiveCount}
          typeCounts={typeCounts}
          value={query.type}
        />
      )}

      {isTrashScope && (
        <TrashScopeBar
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onCollectionScopeChange={onCollectionScopeChange}
        />
      )}

      <ActiveFilterChips
        chips={activeFilterChips}
        onClearFilters={onClearFilters}
      />

      <AdvancedFiltersPanel
        advancedOpen={advancedOpen}
        genreSuggestions={genreSuggestions}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onQueryChange={onQueryChange}
        organizationContributorSuggestions={organizationContributorSuggestions}
        personContributorSuggestions={personContributorSuggestions}
        query={query}
        seriesSuggestions={seriesSuggestions}
        statusCounts={statusCounts}
        tagSuggestions={tagSuggestions}
        totalActiveCount={totalActiveCount}
      />
    </Stack>
  );
}
