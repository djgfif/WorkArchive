import {
  Box,
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
  type WorksIdentityPreset,
  type WorksListQuery,
  type WorksRatingPreset,
  type WorksSmartFilter,
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

const ratingPresetOptions: Array<{ label: string; value: WorksRatingPreset }> = [
  { label: '전체', value: 'all' },
  { label: '미평가', value: 'unrated' },
  { label: '4점 이상', value: 'gte4' },
  { label: '3점 이상', value: 'gte3' },
  { label: '2점 이하', value: 'lte2' },
];

const smartFilterOptions: Array<{ label: string; value: WorksSmartFilter }> = [
  { label: '전체', value: 'all' },
  { label: '즐겨찾기', value: 'favorites' },
  { label: '미평가', value: 'unrated' },
  { label: '정리 필요', value: 'needsCuration' },
];

type QuickCollectionOption =
  | {
      description: string;
      label: string;
      status: WorkStatus;
      type: 'status';
    }
  | {
      description: string;
      label: string;
      type: 'smart';
      value: Exclude<WorksSmartFilter, 'all'>;
    }
  | {
      description: string;
      label: string;
      sortBy: 'createdAt' | 'updatedAt';
      type: 'sort';
    };

const quickCollectionOptions: QuickCollectionOption[] = [
  {
    description: '수정순',
    label: '최근 수정',
    sortBy: 'updatedAt',
    type: 'sort',
  },
  {
    description: '새로 넣은 작품',
    label: '최근 추가',
    sortBy: 'createdAt',
    type: 'sort',
  },
  {
    description: '보는 중',
    label: '이어보기',
    status: 'in_progress',
    type: 'status',
  },
  {
    description: '다시 찾을 작품',
    label: '즐겨찾기',
    type: 'smart',
    value: 'favorites',
  },
  {
    description: '별점 비어 있음',
    label: '미평가',
    type: 'smart',
    value: 'unrated',
  },
  {
    description: '표지·태그 보강',
    label: '정리 필요',
    type: 'smart',
    value: 'needsCuration',
  },
];

const identityPresetOptions: Array<{ label: string; value: WorksIdentityPreset }> = [
  { label: '전체', value: 'all' },
  { label: '직접 등록', value: 'manual' },
  { label: '가져오기', value: 'imported' },
  { label: '카탈로그 연결', value: 'catalogLinked' },
];

function getRatingPresetLabel(value: WorksRatingPreset | undefined) {
  return ratingPresetOptions.find((option) => option.value === value)?.label ?? '전체';
}

function getSmartFilterLabel(value: WorksSmartFilter | undefined) {
  return smartFilterOptions.find((option) => option.value === value)?.label ?? '전체';
}

function getIdentityPresetLabel(value: WorksIdentityPreset | undefined) {
  return identityPresetOptions.find((option) => option.value === value)?.label ?? '전체';
}

function isQuickCollectionActive(
  option: QuickCollectionOption,
  query: WorksListQuery,
) {
  if (option.type === 'smart') {
    return (query.smartFilter ?? 'all') === option.value && query.status === 'all';
  }

  if (option.type === 'status') {
    return (
      query.status === option.status &&
      (query.smartFilter ?? 'all') === 'all'
    );
  }

  return (
    (query.smartFilter ?? 'all') === 'all' &&
    query.status === 'all' &&
    query.sortBy === option.sortBy &&
    (query.sortDirection ?? getDefaultSortDirection(option.sortBy)) ===
      getDefaultSortDirection(option.sortBy)
  );
}

function getQuickCollectionQuery(
  option: QuickCollectionOption,
  query: WorksListQuery,
): WorksListQuery {
  const isActive = isQuickCollectionActive(option, query);

  if (option.type === 'smart') {
    return {
      ...query,
      smartFilter: isActive ? 'all' : option.value,
      status: 'all',
    };
  }

  if (option.type === 'status') {
    return {
      ...query,
      smartFilter: 'all',
      status: isActive ? 'all' : option.status,
    };
  }

  return {
    ...query,
    smartFilter: 'all',
    status: 'all',
    sortBy: option.sortBy,
    sortDirection: getDefaultSortDirection(option.sortBy),
  };
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
      <Group
        align="center"
        className={cn(css.mediaTypeFilterHeader)}
        justify="space-between"
        wrap="nowrap"
      >
        <Text c="var(--app-text-primary)" fw={800} size="sm">
          매체 유형
        </Text>
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
        aria-label="작품 유형으로 빠르게 좁히기"
        role="group"
      >
        <Box className={cn(css.mediaTypeOptions)}>
          {options.map((option) => {
            const isActive = option.value === value;

            return (
              <Box
                aria-label={option.label}
                aria-pressed={isActive}
                className={cn(css.mediaTypeOption)}
                component="button"
                data-active={isActive ? 'true' : 'false'}
                data-empty={option.count === 0 ? 'true' : 'false'}
                key={option.value}
                onClick={() => onChange(option.value)}
                type="button"
              >
                <Text
                  className={cn(css.mediaTypeOptionLabel)}
                  fw={800}
                  size="xs"
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
  const isTrashScope = collectionScope === 'trash';

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
    (query.ratingPreset ?? 'all') !== 'all' ||
    (query.smartFilter ?? 'all') !== 'all' ||
    (query.identityPreset ?? 'all') !== 'all' ||
    query.status !== 'all' ||
    query.type !== 'all' ||
    query.sortBy !== 'updatedAt' ||
    sortDirection !== defaultSortDirection;

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
  const statusFilterOptions = [
    { label: '전체', value: 'all' as const, count: totalActiveCount },
    ...visibleWorkStatusOptions.map((option) => ({
      count: statusCounts[option.value],
      label: option.label,
      value: option.value,
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
    ...(query.rating === null && (query.ratingPreset ?? 'all') !== 'all'
      ? [{ label: `별점: ${getRatingPresetLabel(query.ratingPreset)}`, onRemove: () => onQueryChange({ ...query, ratingPreset: 'all' }) }]
      : []),
    ...((query.smartFilter ?? 'all') !== 'all'
      ? [{ label: getSmartFilterLabel(query.smartFilter), onRemove: () => onQueryChange({ ...query, smartFilter: 'all' }) }]
      : []),
    ...((query.identityPreset ?? 'all') !== 'all'
      ? [{ label: `등록: ${getIdentityPresetLabel(query.identityPreset)}`, onRemove: () => onQueryChange({ ...query, identityPreset: 'all' }) }]
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

  const countSummary = isLoading
    ? '불러오는 중…'
    : isTrashScope
      ? totalDeletedCount === 0
        ? '삭제한 작품이 없습니다.'
        : `삭제한 작품 ${filteredCount}개를 관리 중입니다.`
      : totalActiveCount === 0
        ? '첫 작품을 추가해 보세요.'
        : filteredCount === totalActiveCount
          ? `작품 ${totalActiveCount}개`
          : `${totalActiveCount}개 중 ${filteredCount}개 표시 중`;
  const heroDescription =
    activeFilterChips.length > 0
      ? `${countSummary} · 필터 ${activeFilterChips.length}개 적용`
      : countSummary;

  return (
    <Stack gap="lg">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <ArchiveHero
        actions={
          !isTrashScope ? (
            <AppButton
              leftSection={<IconPlus />}
              onClick={onCreateWork}
              size="md"
              tone="primary"
              type="button"
            >
              작품 추가
            </AppButton>
          ) : undefined
        }
        description={heroDescription}
        eyebrow={isTrashScope ? '삭제 항목 관리' : '내 작품'}
        title={isTrashScope ? '휴지통' : '작품 서재'}
        variant="compact"
      />

      {/* ── 검색 + 컨트롤 바 ── */}
      <Box className={cn(css.toolbarControls)}>
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

      {collectionScope === 'active' && (
        <Stack gap="md">
          {totalActiveCount > 0 && (
            <Box className={cn(css.quickCollectionRail)}>
              <Group align="center" justify="space-between" wrap="wrap">
                <Stack gap={1}>
                  <Text c="var(--app-text-primary)" fw={800} size="sm">
                    빠른 보기
                  </Text>
                  <Text c="var(--app-text-muted)" size="xs">
                    최근 흐름과 정리할 기록을 빠르게 전환합니다.
                  </Text>
                </Stack>
                <Group
                  aria-label="빠른 보기"
                  className={cn(css.quickCollectionOptions)}
                  gap="xs"
                  role="group"
                  wrap="wrap"
                >
                  {quickCollectionOptions.map((option) => {
                    const isActive = isQuickCollectionActive(option, query);

                    return (
                      <Box
                        aria-pressed={isActive}
                        className={cn(css.quickCollectionOption)}
                        component="button"
                        data-active={isActive ? 'true' : 'false'}
                        key={option.label}
                        onClick={() =>
                          onQueryChange(getQuickCollectionQuery(option, query))
                        }
                        type="button"
                      >
                        <span>{option.label}</span>
                        <span aria-hidden="true">{option.description}</span>
                      </Box>
                    );
                  })}
                </Group>
              </Group>
            </Box>
          )}
          <MediaTypeFilter
            onChange={(type) => onQueryChange({ ...query, type })}
            totalCount={totalActiveCount}
            typeCounts={typeCounts}
            value={query.type}
          />
        </Stack>
      )}

      {isTrashScope && (
        <Box className={cn(css.trashScopeBar)}>
          <Stack gap={2} miw={0}>
            <Text c="var(--app-text-primary)" fw={800} size="sm">
              복구가 기본 작업입니다.
            </Text>
            <Text c="var(--app-text-muted)" size="xs">
              삭제한 작품은 서재에서 숨겨진 상태입니다. 복구하면 원래 서재로 돌아갑니다.
            </Text>
          </Stack>
          <Group gap="xs" justify="flex-end" wrap="wrap">
            {hasActiveFilters && (
              <AppButton
                onClick={onClearFilters}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                필터 초기화
              </AppButton>
            )}
            <AppButton
              onClick={() => onCollectionScopeChange('active')}
              size="compact-sm"
              tone="quiet"
              type="button"
            >
              서재 보기
            </AppButton>
          </Group>
        </Box>
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
          {activeFilterChips.map((chip, index) => (
            <Box
              className={cn(css.activeFilterChip)}
              data-mobile-overflow={index >= 3 ? 'true' : 'false'}
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
          {activeFilterChips.length > 3 && (
            <Box className={`${cn(css.activeFilterChip)} ${cn(css.activeFilterMoreChip)}`}>
              필터 {activeFilterChips.length - 3}개 더 있음
            </Box>
          )}
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
      <Box
        className={cn(css.advancedFilterCollapse)}
        data-open={advancedOpen ? 'true' : 'false'}
      >
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
            <FilterSection title="분류">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    장르
                  </Text>
                  <FilterPillGroup
                    aria-label="장르 필터"
                    onChange={(genre) => onQueryChange({ ...query, genre })}
                    options={genreFilterOptions}
                    value={query.genre ?? ''}
                  />
                </Stack>

                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    개인 태그
                  </Text>
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
                </Stack>
              </SimpleGrid>
            </FilterSection>

            <FilterSection title="관계">
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    시리즈 / 세계관
                  </Text>
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
                </Stack>

                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    작가 / 제작진
                  </Text>
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
                </Stack>

                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    회사 / 플랫폼
                  </Text>
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
                </Stack>
              </SimpleGrid>
            </FilterSection>

            <FilterSection title="기록 상태">
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    감상 상태
                  </Text>
                  <FilterPillGroup
                    aria-label="상태 필터"
                    onChange={(status) => onQueryChange({ ...query, status })}
                    options={statusFilterOptions}
                    value={query.status}
                  />
                </Stack>

                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    별점
                  </Text>
                  <FilterPillGroup
                    aria-label="별점 프리셋 필터"
                    onChange={(ratingPreset) =>
                      onQueryChange({ ...query, rating: null, ratingPreset })
                    }
                    options={ratingPresetOptions}
                    value={query.ratingPreset ?? 'all'}
                  />
                </Stack>

                <Stack gap="xs">
                  <Text c="var(--app-text-muted)" fw={700} size="xs">
                    추천 보기
                  </Text>
                  <FilterPillGroup
                    aria-label="추천 보기 필터"
                    onChange={(smartFilter) =>
                      onQueryChange({ ...query, smartFilter })
                    }
                    options={smartFilterOptions}
                    value={query.smartFilter ?? 'all'}
                  />
                </Stack>
              </SimpleGrid>
            </FilterSection>

            <FilterSection title="등록 방식">
              <FilterPillGroup
                aria-label="등록 방식 필터"
                onChange={(identityPreset) =>
                  onQueryChange({ ...query, identityPreset })
                }
                options={identityPresetOptions}
                value={query.identityPreset ?? 'all'}
              />
            </FilterSection>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
