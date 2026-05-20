import { Box, Collapse, Group, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useRef, useState } from 'react';

import type { WorkStatus } from '@work-archive/shared-types';

import { AppButton } from '../../../shared/components/AppPrimitives';
import {
  ArchiveHero,
  ArchiveSearchBar,
  FilterPillGroup,
} from './ArchiveComponents';
import type { WorksCollectionScope } from '../services/works.service';
import type { WorksListQuery } from '../utils/query-works';
import {
  getWorkStatusLabel,
  visibleWorkStatusOptions,
  workSortOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';

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
  viewMode:                 WorksViewMode;
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
  viewMode,
}: WorksToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortAsc, setSortAsc]           = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
    query.sortBy !== 'updatedAt';

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
        <Box
          style={{
            display:       'flex',
            gap:           '0.625rem',
            alignItems:    'center',
            flexWrap:      'wrap',
          }}
        >
          {/* 검색 */}
          <Box style={{ flex: '1 1 220px', minWidth: 0 }}>
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
            <Box
              style={{
                display:      'flex',
                gap:          2,
                background:   'var(--app-surface-subtle)',
                border:       '1px solid var(--app-border-default)',
                borderRadius: 'var(--mantine-radius-md)',
                padding:      2,
                flexShrink:   0,
              }}
            >
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
                    onClick={() => onViewModeChange(mode)}
                    type="button"
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      width:          32,
                      height:         32,
                      borderRadius:   'calc(var(--mantine-radius-md) - 2px)',
                      border:         'none',
                      cursor:         'pointer',
                      transition:     'all var(--wa-motion-fast, 150ms) cubic-bezier(0.16,1,0.3,1)',
                      background:     viewMode === mode
                        ? 'var(--app-surface-card)'
                        : 'transparent',
                      color:          viewMode === mode
                        ? 'var(--app-text-primary)'
                        : 'var(--app-text-muted)',
                      boxShadow:      viewMode === mode
                        ? '0 1px 4px rgba(0,0,0,0.18)'
                        : 'none',
                    }}
                  >
                    {mode === 'grid' ? <IconGrid /> : <IconList />}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          )}

          {/* 정렬 방향 */}
          {query.sortBy !== 'updatedAt' && (
            <Tooltip
              label={sortAsc ? '오름차순 — 클릭하면 내림차순' : '내림차순 — 클릭하면 오름차순'}
              position="bottom"
              withArrow
            >
              <Box
                component="button"
                aria-label={sortAsc ? '오름차순' : '내림차순'}
                aria-pressed={sortAsc}
                onClick={() => setSortAsc((v) => !v)}
                type="button"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            4,
                  padding:        '0 0.625rem',
                  height:         36,
                  borderRadius:   'var(--mantine-radius-md)',
                  border:         '1px solid var(--app-border-default)',
                  background:     'var(--app-surface-subtle)',
                  color:          'var(--app-text-secondary)',
                  fontSize:       '0.78rem',
                  fontWeight:     600,
                  cursor:         'pointer',
                  transition:     'all var(--wa-motion-fast, 150ms)',
                  flexShrink:     0,
                  letterSpacing:  '0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {sortAsc ? <IconSortAsc /> : <IconSortDesc />}
                {sortAsc ? 'ASC' : 'DESC'}
              </Box>
            </Tooltip>
          )}

          {/* 고급 필터 버튼 */}
          <Tooltip label="고급 필터 (f)" position="bottom" withArrow>
            <Box
              component="button"
              aria-expanded={advancedOpen}
              aria-label="고급 필터"
              onClick={() => setAdvancedOpen((v) => !v)}
              type="button"
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            6,
                padding:        '0 0.75rem',
                height:         36,
                borderRadius:   'var(--mantine-radius-md)',
                border:         `1px solid ${advancedOpen ? 'var(--app-accent-primary)' : 'var(--app-border-default)'}`,
                background:     advancedOpen
                  ? 'color-mix(in srgb, var(--app-accent-primary) 10%, transparent)'
                  : 'var(--app-surface-subtle)',
                color:          advancedOpen
                  ? 'var(--app-accent-primary)'
                  : 'var(--app-text-secondary)',
                fontSize:       '0.82rem',
                fontWeight:     600,
                cursor:         'pointer',
                transition:     'all var(--wa-motion-fast, 150ms)',
                flexShrink:     0,
                position:       'relative',
              }}
            >
              <IconFilter />
              필터
              {hasActiveFilters && (
                <Box
                  style={{
                    position:       'absolute',
                    top:            -5,
                    right:          -5,
                    width:          16,
                    height:         16,
                    borderRadius:   '50%',
                    background:     'var(--app-accent-primary)',
                    color:          '#fff',
                    fontSize:       '0.62rem',
                    fontWeight:     800,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                  }}
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
        <Stack gap="sm">
          <Stack gap={6}>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              매체
            </Text>
            <FilterPillGroup
              aria-label="매체 필터"
              onChange={(type) => onQueryChange({ ...query, type })}
              options={[
                { label: '전체', value: 'all' as const },
                ...workTypeOptions.map((o) => ({ label: o.label, value: o.value })),
              ]}
              value={query.type}
            />
          </Stack>
        </Stack>
      )}

      {/* ── 활성 필터 칩 ─────────────────────────────────────────────── */}
      {activeFilterChips.length > 0 && (
        <Group
          aria-label="적용된 필터"
          gap="xs"
          role="group"
          wrap="wrap"
          style={{ paddingTop: 2 }}
        >
          {activeFilterChips.map((chip) => (
            <Box
              key={chip.label}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          5,
                padding:      '0.2rem 0.55rem 0.2rem 0.7rem',
                borderRadius: 999,
                background:   'color-mix(in srgb, var(--app-accent-primary) 12%, transparent)',
                border:       '1px solid color-mix(in srgb, var(--app-accent-primary) 30%, transparent)',
                color:        'var(--app-accent-primary)',
                fontSize:     '0.78rem',
                fontWeight:   600,
              }}
            >
              {chip.label}
              <Box
                component="button"
                aria-label={`${chip.label} 필터 제거`}
                onClick={chip.onRemove}
                type="button"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          16,
                  height:         16,
                  borderRadius:   '50%',
                  border:         'none',
                  background:     'color-mix(in srgb, var(--app-accent-primary) 20%, transparent)',
                  color:          'var(--app-accent-primary)',
                  cursor:         'pointer',
                  padding:        0,
                  transition:     'background var(--wa-motion-fast, 150ms)',
                  flexShrink:     0,
                }}
              >
                <IconX />
              </Box>
            </Box>
          ))}
          <Box
            component="button"
            onClick={onClearFilters}
            type="button"
            style={{
              padding:      '0.2rem 0.6rem',
              borderRadius: 999,
              border:       '1px solid var(--app-border-default)',
              background:   'transparent',
              color:        'var(--app-text-muted)',
              fontSize:     '0.78rem',
              fontWeight:   500,
              cursor:       'pointer',
              transition:   'all var(--wa-motion-fast, 150ms)',
            }}
          >
            모두 지우기
          </Box>
        </Group>
      )}

      {/* ── 고급 필터 패널 ───────────────────────────────────────────── */}
      <Collapse in={advancedOpen}>
        <Box
          style={{
            background:   'var(--app-surface-card)',
            border:       '1px solid var(--app-border-default)',
            borderRadius: 'var(--mantine-radius-xl)',
            padding:      'clamp(1rem, 3vw, 1.5rem)',
          }}
        >
          {/* 패널 헤더 */}
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Box style={{ color: 'var(--app-accent-primary)', display: 'flex', alignItems: 'center' }}>
                <IconFilter size={13} />
              </Box>
              <Text fw={700} size="sm" style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.01em' }}>
                고급 필터
              </Text>
            </Group>
            {hasActiveFilters && (
              <Box
                component="button"
                onClick={onClearFilters}
                type="button"
                style={{
                  padding:      '0.2rem 0.6rem',
                  borderRadius: 999,
                  border:       '1px solid var(--app-border-default)',
                  background:   'transparent',
                  color:        'var(--app-text-muted)',
                  fontSize:     '0.78rem',
                  fontWeight:   500,
                  cursor:       'pointer',
                }}
              >
                전체 초기화
              </Box>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {seriesSuggestions.length > 0 && (
              <Stack gap="xs">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
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
            )}

            {personContributorSuggestions.length > 0 && (
              <Stack gap="xs">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
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
            )}

            {organizationContributorSuggestions.length > 0 && (
              <Stack gap="xs">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
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
            )}

            {genreSuggestions.length > 0 && (
              <Stack gap="xs">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                  장르
                </Text>
                <FilterPillGroup
                  aria-label="장르 필터"
                  onChange={(genre) => onQueryChange({ ...query, genre })}
                  options={[
                    { label: '전체', value: '' },
                    ...genreSuggestions.slice(0, 12).map((genre) => ({
                      label: genre,
                      value: genre,
                    })),
                  ]}
                  value={query.genre ?? ''}
                />
              </Stack>
            )}

            <Stack gap="xs">
              <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                상태
              </Text>
              <FilterPillGroup
                aria-label="상태 필터"
                onChange={(status) => onQueryChange({ ...query, status })}
                options={statusFilterOptions}
                value={query.status}
              />
            </Stack>

            {/* 정렬 */}
            <Stack gap="xs">
              <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                정렬 기준
              </Text>
              <FilterPillGroup
                aria-label="정렬"
                onChange={(sortBy) => onQueryChange({ ...query, sortBy })}
                options={workSortOptions}
                value={query.sortBy}
              />
            </Stack>

            {/* 태그 검색 */}
            <Stack gap="xs">
              <Text c="dimmed" fw={700} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
                개인 태그
              </Text>
              <Box style={{ position: 'relative' }}>
                <Box
                  component="input"
                  list="worksTagFilterSuggestions"
                  name="tag"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onQueryChange({ ...query, tag: e.currentTarget.value })
                  }
                  placeholder="태그로 필터…"
                  value={query.tag ?? ''}
                  style={{
                    width:        '100%',
                    height:       36,
                    padding:      '0 0.75rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    border:       '1px solid var(--app-border-default)',
                    background:   'var(--app-surface-subtle)',
                    color:        'var(--app-text-primary)',
                    fontSize:     '0.875rem',
                    outline:      'none',
                    transition:   'border-color var(--wa-motion-fast, 150ms)',
                  }}
                />
                <datalist id="worksTagFilterSuggestions">
                  {tagSuggestions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </Box>
              {/* 태그 추천 칩 */}
              {tagSuggestions.length > 0 && (
                <Group gap={4} wrap="wrap">
                  {tagSuggestions.slice(0, 8).map((tag) => (
                    <Box
                      key={tag}
                      component="button"
                      onClick={() => onQueryChange({ ...query, tag })}
                      type="button"
                      style={{
                        padding:      '0.15rem 0.5rem',
                        borderRadius: 999,
                        border:       `1px solid ${query.tag === tag ? 'var(--app-accent-primary)' : 'var(--app-border-default)'}`,
                        background:   query.tag === tag
                          ? 'color-mix(in srgb, var(--app-accent-primary) 12%, transparent)'
                          : 'var(--app-surface-subtle)',
                        color:        query.tag === tag
                          ? 'var(--app-accent-primary)'
                          : 'var(--app-text-secondary)',
                        fontSize:     '0.75rem',
                        fontWeight:   500,
                        cursor:       'pointer',
                        transition:   'all var(--wa-motion-fast, 150ms)',
                      }}
                    >
                      #{tag}
                    </Box>
                  ))}
                </Group>
              )}
            </Stack>
          </SimpleGrid>
        </Box>
      </Collapse>
    </Stack>
  );
}
