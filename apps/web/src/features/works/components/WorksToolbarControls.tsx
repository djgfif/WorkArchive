import type { RefObject } from 'react';
import { Box, NativeSelect, Tooltip } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();

  return (
    <Box className={cn(css.toolbarControls)}>
      <FilterPillGroup
        aria-label={t('works.list.collectionScope')}
        onChange={onCollectionScopeChange}
        options={[
          {
            label: t('works.list.library'),
            value: 'active',
            count: totalActiveCount,
          },
          {
            label: t('works.list.trash'),
            value: 'trash',
            count: totalDeletedCount,
          },
        ]}
        value={collectionScope}
      />

      <Box className={cn(css.toolbarSearch)}>
        <ArchiveSearchBar
          aria-label={t('works.list.search')}
          inputRef={searchRef}
          onChange={(searchTerm) => onQueryChange({ ...query, searchTerm })}
          placeholder={
            isTrashScope
              ? t('works.list.searchTrashPlaceholder')
              : t('works.list.searchActivePlaceholder')
          }
          value={query.searchTerm}
        />
      </Box>

      <NativeSelect
        aria-label={t('works.list.sortLabel')}
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
              label={
                mode === 'grid'
                  ? t('works.list.gridViewShortcut')
                  : t('works.list.listViewShortcut')
              }
              position="bottom"
              withArrow
            >
              <Box
                aria-label={
                  mode === 'grid'
                    ? t('works.list.gridView')
                    : t('works.list.listView')
                }
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
              {
                density: 'comfortable',
                icon: <IconGrid />,
                label: t('works.list.comfortableView'),
              },
              {
                density: 'compact',
                icon: <IconGridCompact />,
                label: t('works.list.compactView'),
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
            ? t('works.list.sortAscToggle')
            : t('works.list.sortDescToggle')
        }
        position="bottom"
        withArrow
      >
        <Box
          aria-label={
            sortDirection === 'asc'
              ? t('works.list.sortAsc')
              : t('works.list.sortDesc')
          }
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
          {sortDirection === 'asc'
            ? t('works.list.sortAsc')
            : t('works.list.sortDesc')}
        </Box>
      </Tooltip>

      <Tooltip
        label={t('works.list.advancedFilterShortcut')}
        position="bottom"
        withArrow
      >
        <Box
          aria-expanded={advancedOpen}
          aria-label={t('works.list.advancedFilter')}
          className={cn(css.advancedFilterButton)}
          component="button"
          data-active={advancedOpen ? 'true' : 'false'}
          onClick={onToggleAdvanced}
          type="button"
        >
          <IconFilter />
          {t('works.list.filter')}
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
