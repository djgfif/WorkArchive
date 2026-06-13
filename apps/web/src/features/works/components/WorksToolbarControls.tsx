import type { RefObject } from 'react';
import { Box, NativeSelect, Tooltip } from '@mantine/core';

import { FilterPillGroup, ArchiveSearchBar } from './ArchiveComponents';
import {
  IconFilter,
  IconGrid,
  IconGridCompact,
  IconList,
  IconSort,
  IconSortAsc,
  IconSortDesc,
} from './WorksToolbarIcons';
import styles from './ArchiveComponents.module.css';
import type { WorksCollectionScope } from '../services/works.service';
import {
  getDefaultSortDirection,
  type WorksListQuery,
} from '../utils/query-works';
import { workSortOptions } from '../utils/work-options';
import type { LibraryDensity } from '../hooks/useLibraryDensity';
import type { WorksViewMode } from './WorksList';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorksToolbarControlsProps {
  activeFilterCount: number;
  advancedOpen: boolean;
  collectionScope: WorksCollectionScope;
  density: LibraryDensity;
  hasActiveFilters: boolean;
  isTrashScope: boolean;
  onCollectionScopeChange: (scope: WorksCollectionScope) => void;
  onDensityChange: (density: LibraryDensity) => void;
  onQueryChange: (query: WorksListQuery) => void;
  onToggleAdvanced: () => void;
  onViewModeChange: (viewMode: WorksViewMode) => void;
  query: WorksListQuery;
  searchRef: RefObject<HTMLInputElement | null>;
  sortDirection: NonNullable<WorksListQuery['sortDirection']>;
  totalActiveCount: number;
  totalDeletedCount: number;
  viewMode: WorksViewMode;
}

export function WorksToolbarControls({
  activeFilterCount,
  advancedOpen,
  collectionScope,
  density,
  hasActiveFilters,
  isTrashScope,
  onCollectionScopeChange,
  onDensityChange,
  onQueryChange,
  onToggleAdvanced,
  onViewModeChange,
  query,
  searchRef,
  sortDirection,
  totalActiveCount,
  totalDeletedCount,
  viewMode,
}: WorksToolbarControlsProps) {
  return (
    <Box className={cn(css.toolbarControls)}>
      <FilterPillGroup
        aria-label="작품 범위"
        onChange={onCollectionScopeChange}
        options={[
          { label: '서재', value: 'active', count: totalActiveCount },
          { label: '휴지통', value: 'trash', count: totalDeletedCount },
        ]}
        value={collectionScope}
      />

      <Box className={cn(css.toolbarSearch)}>
        <ArchiveSearchBar
          aria-label="작품 검색 (단축키: /)"
          inputRef={searchRef}
          onChange={(searchTerm) => onQueryChange({ ...query, searchTerm })}
          placeholder={
            isTrashScope
              ? '삭제된 작품 검색  (/)'
              : '제목, 작가, 태그 검색  (/)'
          }
          value={query.searchTerm}
        />
      </Box>

      <NativeSelect
        aria-label="정렬 기준"
        className={cn(css.toolbarSortSelect)}
        data={workSortOptions.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        leftSection={<IconSort />}
        leftSectionPointerEvents="none"
        onChange={(event) =>
          onQueryChange({
            ...query,
            sortBy: event.currentTarget.value as typeof query.sortBy,
            sortDirection: getDefaultSortDirection(
              event.currentTarget.value as typeof query.sortBy,
            ),
          })
        }
        size="sm"
        value={query.sortBy}
      />

      {collectionScope === 'active' && (
        <Box className={cn(css.viewToggle)}>
          {(['grid', 'list'] as const).map((mode) => (
            <Tooltip
              key={mode}
              label={mode === 'grid' ? '포스터 뷰 (g)' : '리스트 뷰 (g)'}
              position="bottom"
              withArrow
            >
              <Box
                aria-label={mode === 'grid' ? '포스터 뷰' : '리스트 뷰'}
                aria-pressed={viewMode === mode}
                className={cn(css.viewToggleButton)}
                component="button"
                data-active={viewMode === mode ? 'true' : 'false'}
                onClick={() => onViewModeChange(mode)}
                type="button"
              >
                {mode === 'grid' ? <IconGrid /> : <IconList />}
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}

      {collectionScope === 'active' && viewMode === 'grid' && (
        <Box className={cn(css.viewToggle)}>
          {(
            [
              { density: 'comfortable', icon: <IconGrid />, label: '넓게 보기' },
              {
                density: 'compact',
                icon: <IconGridCompact />,
                label: '촘촘히 보기',
              },
            ] as const
          ).map((option) => (
            <Tooltip
              key={option.density}
              label={option.label}
              position="bottom"
              withArrow
            >
              <Box
                aria-label={option.label}
                aria-pressed={density === option.density}
                className={cn(css.viewToggleButton)}
                component="button"
                data-active={density === option.density ? 'true' : 'false'}
                onClick={() => onDensityChange(option.density)}
                type="button"
              >
                {option.icon}
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}

      <Tooltip
        label={
          sortDirection === 'asc'
            ? '오름차순 — 클릭하면 내림차순'
            : '내림차순 — 클릭하면 오름차순'
        }
        position="bottom"
        withArrow
      >
        <Box
          aria-label={sortDirection === 'asc' ? '오름차순' : '내림차순'}
          aria-pressed={sortDirection === 'asc'}
          className={cn(css.sortDirectionButton)}
          component="button"
          onClick={() =>
            onQueryChange({
              ...query,
              sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
            })
          }
          type="button"
        >
          {sortDirection === 'asc' ? <IconSortAsc /> : <IconSortDesc />}
          {sortDirection === 'asc' ? '오름차순' : '내림차순'}
        </Box>
      </Tooltip>

      <Tooltip label="고급 필터 (f)" position="bottom" withArrow>
        <Box
          aria-expanded={advancedOpen}
          aria-label="고급 필터"
          className={cn(css.advancedFilterButton)}
          component="button"
          data-active={advancedOpen ? 'true' : 'false'}
          onClick={onToggleAdvanced}
          type="button"
        >
          <IconFilter />
          필터
          {hasActiveFilters && (
            <Box className={cn(css.advancedFilterCount)}>
              {activeFilterCount}
            </Box>
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}
