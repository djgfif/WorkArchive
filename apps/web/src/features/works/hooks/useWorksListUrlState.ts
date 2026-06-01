import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { WorksViewMode } from '../components/WorksList';
import type { WorksCollectionScope } from '../services/works.service';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import {
  buildSearchParams,
  getCollectionScopeFromSearchParams,
  getQueryFromSearchParams,
  getViewModeFromSearchParams,
} from '../utils/works-list-url-state';

export function useWorksListUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [collectionScope, setCollectionScope] = useState<WorksCollectionScope>(
    () => getCollectionScopeFromSearchParams(searchParams),
  );
  const [query, setQuery] = useState<WorksListQuery>(() =>
    getQueryFromSearchParams(searchParams),
  );
  const [viewMode, setViewMode] = useState<WorksViewMode>(() =>
    getViewModeFromSearchParams(searchParams),
  );

  useEffect(() => {
    const nextQuery = getQueryFromSearchParams(searchParams);
    const nextScope = getCollectionScopeFromSearchParams(searchParams);
    const nextViewMode = getViewModeFromSearchParams(searchParams);

    setCollectionScope((currentScope) =>
      currentScope === nextScope ? currentScope : nextScope,
    );
    setQuery((currentQuery) =>
      JSON.stringify(currentQuery) === JSON.stringify(nextQuery)
        ? currentQuery
        : nextQuery,
    );
    setViewMode((currentViewMode) =>
      currentViewMode === nextViewMode ? currentViewMode : nextViewMode,
    );
  }, [searchParams]);

  function handleQueryChange(nextQuery: WorksListQuery) {
    setQuery(nextQuery);
    setSearchParams(buildSearchParams(nextQuery, collectionScope, viewMode), {
      replace: true,
    });
  }

  function handleCollectionScopeChange(nextScope: WorksCollectionScope) {
    setCollectionScope(nextScope);
    setSearchParams(buildSearchParams(query, nextScope, viewMode), {
      replace: true,
    });
  }

  function handleViewModeChange(nextViewMode: WorksViewMode) {
    setViewMode(nextViewMode);
    setSearchParams(buildSearchParams(query, collectionScope, nextViewMode), {
      replace: true,
    });
  }

  function handleClearFilters() {
    setQuery(DEFAULT_WORKS_LIST_QUERY);
    setSearchParams(
      buildSearchParams(DEFAULT_WORKS_LIST_QUERY, collectionScope, viewMode),
      { replace: true },
    );
  }

  return {
    collectionScope,
    handleClearFilters,
    handleCollectionScopeChange,
    handleQueryChange,
    handleViewModeChange,
    query,
    viewMode,
  };
}
