import {
  Box,
  Collapse,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useRef, useState, type ReactNode } from 'react';

import type { WorkStatus, WorkType } from '@work-archive/shared-types';

import { AppButton } from '@shared/components/AppPrimitives';
import {
  ArchiveHero,
  ArchiveSearchBar,
  FilterPillGroup,
} from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import type { WorksCollectionScope } from '../services/works.service';
import {
  getDefaultSortDirection,
  type WorksListQuery,
} from '../utils/query-works';
import { WORK_GENRES, isWorkGenre } from '../utils/work-genres';
import {
  getWorkStatusLabel,
  visibleWorkStatusOptions,
  workSortOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

/* ── 아이콘 ── */
function IconGrid({ size = 14 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <rect height="7" width="7" x="3" y="3" /><rect height="7" width="7" x="14" y="3" />
      <rect height="7" width="7" x="14" y="14" /><rect height="7" width="7" x="3" y="14" />
    </svg>
  );
}
function IconList({ size = 14 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}
function IconFilter({ size = 14 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function IconX({ size = 12 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24" width={size}>
      <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
function IconSortAsc({ size = 13 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <line x1="12" x2="12" y1="19" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function IconSortDesc({ size = 13 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <line x1="12" x2="12" y1="5" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24" width={size}>
      <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

interface WorksToolbarProps {
  collectionScope:          WorksCollectionScope;
  filteredCount:            number;
  genreSuggestions:         string[];
  isLoading:                boolean;
  organizationContributorSuggestions: string[];
  onClearFilters:           () => void;
  onCollectionScopeChange:  (scope: WorksCollectionScope) => void;
  onCreateWork:             () => void;
  onQueryChange:            (query: WorksListQuery) => void;
  onViewModeChange:         (viewMode: WorksViewMode) => void;
  personContributorSuggestions: string[];
  query:                    WorksListQuery;
  seriesSuggestions:        string[];
  statusCounts:             Record<WorkStatus, number>;
  tagSuggestions:           string[];
  totalActiveCount:         number;
  totalDeletedCount:        number;
  typeCounts:               Record<WorkType, number>;
  viewMode:                 WorksViewMode;
}

interface MediaTypeFilterProps {
  onChange: (type: WorksListQuery['type']) => void;
  totalCount: number;
  typeCounts: Record<WorkType, number>;
  value: WorksListQuery['type'];
}

function MediaTypeFilter({
  onChange,
  totalCount,
  typeCounts,
  value,
}: MediaTypeFilterProps) {
  const activeLabel =
    value === 'all'
      ? '전체 매체'
      : (workTypeOptions.find((option) => option.value === value)?.label ?? value);
  const options = [
    { count: totalCount, label: '전체', value: 'all' as const },
    ...workTypeOptions.map((option) => ({
      count: typeCounts[option.value],
      label: option.label,
      value: option.value,
    })),
  ];

  return (
    <Box className={cn(css.mediaTypeFilter)}>
      <Group align="center" justify="space-between" mb="xs" wrap="wrap">
        <Stack gap={1}>
          <Text c="dimmed" fw={800} size="xs" tt="uppercase">
            매체
          </Text>
          <Text fw={800} size="sm">
            작품 유형으로 빠르게 좁히기
          </Text>
        </Stack>
        <Text
          className={cn(css.numericText)}
          c="var(--app-text-secondary)"
          fw={700}
          size="xs"
        >
          {activeLabel} · {value === 'all' ? totalCount : typeCounts[value]}개
        </Text>
      </Group>

      <Box
        aria-label="매체 필터"
        className={cn(css.mediaTypeOptions)}
        role="group"
      >
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <Box
              aria-label={option.label}
              aria-pressed={isActive}
              className={cn(css.mediaTypeOption)}
              component="button"
              data-active={isActive ? 'true' : 'false'}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <Text
                className={cn(css.mediaTypeOptionLabel)}
                fw={800}
                size="sm"
              >
                {option.label}
              </Text>
              <Text
                aria-hidden="true"
                className={cn(css.mediaTypeOptionCount)}
                fw={800}
                size="xs"
              >
                {option.count}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

interface FilterSectionProps {
  children: ReactNode;
  description?: string;
  frame?: 'default' | 'quiet';
  title: string;
}

function FilterSection({
  children,
  description,
  frame = 'default',
  title,
}: FilterSectionProps) {
  const isQuiet = frame === 'quiet';

  return (
    <Box className={cn(css.filterSection)} data-frame={isQuiet ? 'quiet' : 'default'}>
      <Stack gap="sm">
        <Group align="baseline" gap="xs" wrap="wrap">
          <Text
            className={cn(css.filterSectionTitle)}
            c="var(--app-text-primary)"
            fw={800}
            size="sm"
          >
            {title}
          </Text>
          {description ? (
            <Text c="var(--app-text-muted)" size="xs">
              {description}
            </Text>
          ) : null}
        </Group>
        {children}
      </Stack>
    </Box>
  );
}

export function WorksToolbar({
  collectionScope,
  filteredCount,
  genreSuggestions,
  isLoading,
  organizationContributorSuggestions,
  onClearFilters,
  onCollectionScopeChange,
  onCreateWork,
  onQueryChange,
  onViewModeChange,
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

  /* ── 키보드 단축키 ── */
  useHotkeys([
    ['slash',  () => { searchRef.current?.focus(); searchRef.current?.select(); }],
    ['Escape', () => {
      if (query.searchTerm) {
        onQueryChange({ ...query, searchTerm: '' });
        searchRef.current?.blur();
      }
    }],
    ['g', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      onViewModeChange(viewMode === 'grid' ? 'list' : 'grid');
    }],
    ['f', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      setAdvancedOpen((v) => !v);
    }],
  ]);

  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    (query.series?.trim() ?? '') !== '' ||
    (query.contributor?.trim() ?? '') !== '' ||
    (query.personContributor?.trim() ?? '') !== '' ||
    (query.organizationContributor?.trim() ?? '') !== '' ||
    (query.genre?.trim() ?? '') !== '' ||
    (query.tag?.trim() ?? '') !== '' ||
    query.rating !== null ||
    query.status !== 'all' ||
    query.type !== 'all' ||
    query.sortBy !== 'updatedAt' ||
    sortDirection !== defaultSortDirection;

  const countSummary = isLoading
    ? '불러오는 중…'
    : collectionScope === 'trash'
      ? totalDeletedCount === 0 ? '휴지통이 비어 있습니다.' : `숨겨둔 작품 ${filteredCount}개`
      : totalActiveCount === 0
        ? '첫 작품을 추가해 보세요.'
        : filteredCount === totalActiveCount
          ? `작품 ${totalActiveCount}개`
          : `${totalActiveCount}개 중 ${filteredCount}개 표시 중`;

  const statusFilterOptions = [
    { label: '전체', value: 'all' as const, count: totalActiveCount },
    ...visibleWorkStatusOptions.map((o) => ({
      label: getWorkStatusLabel(o.value),
      value: o.value,
      count:
        o.value === 'dropped'
          ? statusCounts.dropped
          : statusCounts[o.value],
    })),
  ];
  const genreFilterOptions = [
    { label: '전체', value: '' },
    ...Array.from(
      new Set([
        ...genreSuggestions.filter(isWorkGenre),
        ...WORK_GENRES,
      ]),
    ).map((genre) => ({
      label: genre,
      value: genre,
    })),
  ];

  const activeFilterChips = [
    ...(query.searchTerm.trim()
      ? [{ label: `"${query.searchTerm.trim()}"`, onRemove: () => onQueryChange({ ...query, searchTerm: '' }) }]
      : []),
    ...(query.series?.trim()
      ? [{ label: `시리즈: ${query.series.trim()}`, onRemove: () => onQueryChange({ ...query, series: '' }) }]
      : []),
    ...(query.contributor?.trim()
      ? [{ label: `제작진: ${query.contributor.trim()}`, onRemove: () => onQueryChange({ ...query, contributor: '' }) }]
      : []),
    ...(query.personContributor?.trim()
      ? [{ label: `작가/제작진: ${query.personContributor.trim()}`, onRemove: () => onQueryChange({ ...query, personContributor: '' }) }]
      : []),
    ...(query.organizationContributor?.trim()
      ? [{ label: `회사/플랫폼: ${query.organizationContributor.trim()}`, onRemove: () => onQueryChange({ ...query, organizationContributor: '' }) }]
      : []),
    ...(query.genre?.trim()
      ? [{ label: `장르: ${query.genre.trim()}`, onRemove: () => onQueryChange({ ...query, genre: '' }) }]
      : []),
    ...(query.tag?.trim()
      ? [{ label: `#${query.tag.trim()}`, onRemove: () => onQueryChange({ ...query, tag: '' }) }]
      : []),
    ...(query.status !== 'all'
      ? [{ label: getWorkStatusLabel(query.status), onRemove: () => onQueryChange({ ...query, status: 'all' }) }]
      : []),
    ...(query.rating !== null
      ? [{ label: `★ ${query.rating.toFixed(1)}`, onRemove: () => onQueryChange({ ...query, rating: null }) }]
      : []),
    ...(query.type !== 'all'
      ? [{ label: workTypeOptions.find((o) => o.value === query.type)?.label ?? query.type, onRemove: () => onQueryChange({ ...query, type: 'all' }) }]
      : []),
    ...(query.sortBy !== 'updatedAt'
      ? [{ label: `정렬: ${workSortOptions.find((o) => o.value === query.sortBy)?.label ?? query.sortBy}`, onRemove: () => onQueryChange({ ...query, sortBy: 'updatedAt' }) }]
      : []),
    ...(sortDirection !== defaultSortDirection
      ? [{ label: sortDirection === 'asc' ? '오름차순' : '내림차순', onRemove: () => onQueryChange({ ...query, sortDirection: defaultSortDirection }) }]
      : []),
  ];

  return (
    <Stack gap="lg">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <ArchiveHero
        actions={
          <AppButton
            leftSection={<IconPlus />}
            onClick={onCreateWork}
            size="md"
            tone="primary"
            type="button"
          >
            작품 추가
          </AppButton>
        }
        description={countSummary}
        eyebrow="내 작품"
        title="작품 서재"
        variant="compact"
      >
        {/* ── 검색 + 컨트롤 바 ── */}
        <Box className={cn(css.toolbarControls)}>
          {/* 검색 */}
          <Box className={cn(css.toolbarSearch)}>
            <ArchiveSearchBar
              aria-label="작품 검색 (단축키: /)"
              inputRef={searchRef}
              onChange={(searchTerm) => onQueryChange({ ...query, searchTerm })}
              placeholder="제목, 작가, 태그 검색  (/)"
              value={query.searchTerm}
            />
          </Box>

          {/* 뷰 모드 토글 */}
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
                    component="button"
                    aria-label={mode === 'grid' ? '포스터 뷰' : '리스트 뷰'}
                    aria-pressed={viewMode === mode}
                    className={cn(css.viewToggleButton)}
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

          {/* 정렬 방향 */}
          <NativeSelect
            aria-label="정렬 기준"
            data={workSortOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
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
            className={cn(css.toolbarSortSelect)}
            value={query.sortBy}
          />

          {query.sortBy !== 'updatedAt' || sortDirection !== defaultSortDirection ? (
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
                component="button"
                aria-label={
                  sortDirection === 'asc' ? '오름차순' : '내림차순'
                }
                aria-pressed={sortDirection === 'asc'}
                className={cn(css.sortDirectionButton)}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    sortDirection:
                      sortDirection === 'asc' ? 'desc' : 'asc',
                  })
                }
                type="button"
              >
                {sortDirection === 'asc' ? <IconSortAsc /> : <IconSortDesc />}
                {sortDirection === 'asc' ? 'ASC' : 'DESC'}
              </Box>
            </Tooltip>
          ) : null}

          {/* 고급 필터 버튼 */}
          <Tooltip label="고급 필터 (f)" position="bottom" withArrow>
            <Box
              component="button"
              aria-expanded={advancedOpen}
              aria-label="고급 필터"
              className={cn(css.advancedFilterButton)}
              data-active={advancedOpen ? 'true' : 'false'}
              onClick={() => setAdvancedOpen((v) => !v)}
              type="button"
            >
              <IconFilter />
              필터
              {hasActiveFilters && (
                <Box
                  className={cn(css.advancedFilterCount)}
                >
                  {activeFilterChips.length}
                </Box>
              )}
            </Box>
          </Tooltip>

          {/* 범위 전환 (활성/휴지통) */}
          <FilterPillGroup
            aria-label="작품 범위"
            onChange={onCollectionScopeChange}
            options={[
              { label: '서재', value: 'active', count: totalActiveCount },
              { label: '휴지통', value: 'trash', count: totalDeletedCount },
            ]}
            value={collectionScope}
          />
        </Box>
      </ArchiveHero>

      {collectionScope === 'active' && (
        <MediaTypeFilter
          onChange={(type) => onQueryChange({ ...query, type })}
          totalCount={totalActiveCount}
          typeCounts={typeCounts}
          value={query.type}
        />
      )}

      {/* ── 활성 필터 칩 ─────────────────────────────────────────────── */}
      {activeFilterChips.length > 0 && (
        <Group
          aria-label="적용된 필터"
          className={cn(css.activeFilterGroup)}
          gap="xs"
          role="group"
          wrap="wrap"
        >
          {activeFilterChips.map((chip) => (
            <Box
              className={cn(css.activeFilterChip)}
              key={chip.label}
            >
              {chip.label}
              <Box
                component="button"
                aria-label={`${chip.label} 필터 제거`}
                className={cn(css.activeFilterRemove)}
                onClick={chip.onRemove}
                type="button"
              >
                <IconX />
              </Box>
            </Box>
          ))}
          <Box
            className={cn(css.chipResetButton)}
            component="button"
            onClick={onClearFilters}
            type="button"
          >
            모두 지우기
          </Box>
        </Group>
      )}

      {/* ── 고급 필터 패널 ───────────────────────────────────────────── */}
      <Collapse in={advancedOpen}>
        <Box className={cn(css.advancedFilterPanel)}>
          {/* 패널 헤더 */}
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Box className={cn(css.advancedFilterHeaderIcon)}>
                <IconFilter size={13} />
              </Box>
              <Text className={cn(css.advancedFilterTitle)} fw={700} size="sm">
                세부 필터
              </Text>
            </Group>
            {hasActiveFilters && (
              <Box
                className={cn(css.chipResetButton)}
                component="button"
                onClick={onClearFilters}
                type="button"
              >
                전체 초기화
              </Box>
            )}
          </Group>

          <Stack gap="md">
            {(seriesSuggestions.length > 0 ||
              personContributorSuggestions.length > 0 ||
              organizationContributorSuggestions.length > 0) && (
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                {seriesSuggestions.length > 0 && (
                  <FilterSection title="시리즈 / 세계관">
                    <FilterPillGroup
                      aria-label="시리즈 필터"
                      onChange={(series) => onQueryChange({ ...query, series })}
                      options={[
                        { label: '전체', value: '' },
                        ...seriesSuggestions.slice(0, 12).map((series) => ({
                          label: series,
                          value: series,
                        })),
                      ]}
                      value={query.series ?? ''}
                    />
                  </FilterSection>
                )}

                {personContributorSuggestions.length > 0 && (
                  <FilterSection title="작가 / 제작진">
                    <FilterPillGroup
                      aria-label="작가 제작진 필터"
                      onChange={(personContributor) =>
                        onQueryChange({ ...query, personContributor })
                      }
                      options={[
                        { label: '전체', value: '' },
                        ...personContributorSuggestions.slice(0, 12).map((contributor) => ({
                          label: contributor,
                          value: contributor,
                        })),
                      ]}
                      value={query.personContributor ?? ''}
                    />
                  </FilterSection>
                )}

                {organizationContributorSuggestions.length > 0 && (
                  <FilterSection title="회사 / 플랫폼">
                    <FilterPillGroup
                      aria-label="회사 플랫폼 필터"
                      onChange={(organizationContributor) =>
                        onQueryChange({ ...query, organizationContributor })
                      }
                      options={[
                        { label: '전체', value: '' },
                        ...organizationContributorSuggestions.slice(0, 12).map((contributor) => ({
                          label: contributor,
                          value: contributor,
                        })),
                      ]}
                      value={query.organizationContributor ?? ''}
                    />
                  </FilterSection>
                )}
              </SimpleGrid>
            )}

            <FilterSection frame="quiet" title="장르">
              <FilterPillGroup
                aria-label="장르 필터"
                onChange={(genre) => onQueryChange({ ...query, genre })}
                options={genreFilterOptions}
                value={query.genre ?? ''}
              />
            </FilterSection>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <FilterSection title="상태">
                <FilterPillGroup
                  aria-label="상태 필터"
                  onChange={(status) => onQueryChange({ ...query, status })}
                  options={statusFilterOptions}
                  value={query.status}
                />
              </FilterSection>

              <FilterSection title="개인 태그">
                <Box className={cn(css.tagFilterField)}>
                  <Box
                    component="input"
                    list="worksTagFilterSuggestions"
                    name="tag"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      onQueryChange({ ...query, tag: e.currentTarget.value })
                    }
                    placeholder="태그로 필터…"
                    value={query.tag ?? ''}
                    className={cn(css.tagFilterInput)}
                  />
                  <datalist id="worksTagFilterSuggestions">
                    {tagSuggestions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </Box>
                {tagSuggestions.length > 0 && (
                  <Group gap={4} wrap="wrap">
                    {tagSuggestions.slice(0, 8).map((tag) => (
                      <Box
                        key={tag}
                        component="button"
                        className={cn(css.tagSuggestionChip)}
                        data-active={query.tag === tag ? 'true' : 'false'}
                        onClick={() => onQueryChange({ ...query, tag })}
                        type="button"
                      >
                        #{tag}
                      </Box>
                    ))}
                  </Group>
                )}
              </FilterSection>
            </SimpleGrid>
          </Stack>
        </Box>
      </Collapse>
    </Stack>
  );
}
