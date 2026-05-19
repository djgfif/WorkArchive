import { Collapse, Group, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useRef, useState } from 'react';

import type { WorkStatus } from '@work-archive/shared-types';

import { AppButton, AppBadge } from '../../../shared/components/AppPrimitives';
import {
  ArchiveHero,
  ArchiveSearchBar,
  FilterPillGroup,
} from './ArchiveComponents';
import type { WorksCollectionScope } from '../services/works.service';
import type { WorksListQuery } from '../utils/query-works';
import {
  getWorkStatusLabel,
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';

const ratingFilterOptions = Array.from({ length: 10 }, (_, index) => {
  const value = ((index + 1) * 0.5).toFixed(1);

  return { label: `★ ${value}+`, value };
}).reverse();

interface WorksToolbarProps {
  collectionScope: WorksCollectionScope;
  filteredCount: number;
  isLoading: boolean;
  onClearFilters: () => void;
  onCollectionScopeChange: (scope: WorksCollectionScope) => void;
  onCreateWork: () => void;
  onQueryChange: (query: WorksListQuery) => void;
  onViewModeChange: (viewMode: WorksViewMode) => void;
  query: WorksListQuery;
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  totalActiveCount: number;
  totalDeletedCount: number;
  viewMode: WorksViewMode;
}

export function WorksToolbar({
  collectionScope,
  filteredCount,
  isLoading,
  onClearFilters,
  onCollectionScopeChange,
  onCreateWork,
  onQueryChange,
  onViewModeChange,
  query,
  statusCounts,
  tagSuggestions,
  totalActiveCount,
  totalDeletedCount,
  viewMode,
}: WorksToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── 키보드 단축키 ── */
  useHotkeys([
    // '/' — 검색상자 포커스
    ['slash', () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }],
    // 'Escape' — 검색어 입력 시 지우기
    ['Escape', () => {
      if (query.searchTerm) {
        onQueryChange({ ...query, searchTerm: '' });
        searchRef.current?.blur();
      }
    }],
    // 'g' — 그리드/리스트 전환 (입력 필드 외부에서만)
    ['g', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      onViewModeChange(viewMode === 'grid' ? 'list' : 'grid');
    }],
    // 'f' — 고급 필터 패널 토글
    ['f', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      setAdvancedOpen((v) => !v);
    }],
  ]);

  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    (query.tag?.trim() ?? '') !== '' ||
    query.rating !== null ||
    query.status !== 'all' ||
    query.type !== 'all' ||
    query.sortBy !== 'updatedAt';

  const countSummary = isLoading
    ? '작품을 불러오는 중입니다.'
    : collectionScope === 'trash'
      ? totalDeletedCount === 0
        ? '휴지통이 비어 있습니다.'
        : `숨겨둔 작품 ${filteredCount}개`
      : totalActiveCount === 0
        ? '제목 하나만 넣고 첫 기록을 시작해 보세요.'
        : filteredCount === totalActiveCount
          ? `작품 ${totalActiveCount}개`
          : `전체 ${totalActiveCount}개 중 ${filteredCount}개`;

  const statusFilterOptions = [
    { label: '전체', value: 'all' as const, count: totalActiveCount },
    ...workStatusOptions.map((option) => ({
      label: getWorkStatusLabel(option.value),
      value: option.value,
      count: statusCounts[option.value],
    })),
  ];

  const activeFilterChips = [
    ...(query.searchTerm.trim()
      ? [
          {
            label: `검색: ${query.searchTerm.trim()}`,
            onRemove: () => onQueryChange({ ...query, searchTerm: '' }),
          },
        ]
      : []),
    ...(query.tag?.trim()
      ? [
          {
            label: `태그: ${query.tag.trim()}`,
            onRemove: () => onQueryChange({ ...query, tag: '' }),
          },
        ]
      : []),
    ...(query.status !== 'all'
      ? [
          {
            label: `상태: ${getWorkStatusLabel(query.status)}`,
            onRemove: () => onQueryChange({ ...query, status: 'all' }),
          },
        ]
      : []),
    ...(query.rating !== null
      ? [
          {
            label: `★ ${query.rating.toFixed(1)}점+`,
            onRemove: () => onQueryChange({ ...query, rating: null }),
          },
        ]
      : []),
    ...(query.type !== 'all'
      ? [
          {
            label: `유형: ${
              workTypeOptions.find((option) => option.value === query.type)?.label ??
              query.type
            }`,
            onRemove: () => onQueryChange({ ...query, type: 'all' }),
          },
        ]
      : []),
    ...(query.sortBy !== 'updatedAt'
      ? [
          {
            label: `정렬: ${
              workSortOptions.find((option) => option.value === query.sortBy)?.label ??
              query.sortBy
            }`,
            onRemove: () => onQueryChange({ ...query, sortBy: 'updatedAt' }),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      {/* ── Hero header ──────────────────────────────────────────────── */}
      <ArchiveHero
        actions={
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            {hasActiveFilters && (
              <AppButton onClick={onClearFilters} size="compact-sm" tone="ghost" type="button">
                초기화
              </AppButton>
            )}
            <AppButton onClick={onCreateWork} size="md" tone="primary" type="button">
              + 작품 추가
            </AppButton>
          </Group>
        }
        description={countSummary}
        eyebrow="내 작품"
        title="작품 서재"
        variant="compact"
      >
        {/* Search bar */}
        <ArchiveSearchBar
          aria-label="작품 라이브러리 검색 (단축키: /)"
          inputRef={searchRef}
          onChange={(searchTerm) => onQueryChange({ ...query, searchTerm })}
          placeholder="제목, 작가, 태그 검색  (/)"
          value={query.searchTerm}
        />

        {/* Scope + view mode row */}
        <Group gap="md" justify="space-between" wrap="wrap">
          <FilterPillGroup
            aria-label="작품 범위"
            onChange={onCollectionScopeChange}
            options={[
              { label: '작품', value: 'active', count: totalActiveCount },
              { label: '휴지통', value: 'trash', count: totalDeletedCount },
            ]}
            value={collectionScope}
          />
          <Group gap="xs" wrap="nowrap">
            {collectionScope === 'active' && (
              <FilterPillGroup
                aria-label="보기 방식 (단축키: g)"
                onChange={onViewModeChange}
                options={[
                  { label: '포스터', value: 'grid' },
                  { label: '리스트', value: 'list' },
                ]}
                value={viewMode}
              />
            )}
            {/* 정렬 방향 토글 */}
            {query.sortBy !== 'updatedAt' && (
              <Tooltip
                label={sortAsc ? '오름차순 정렬 중 — 클릭하면 내림차순' : '내림차순 정렬 중 — 클릭하면 오름차순'}
                position="bottom"
                withArrow
              >
                <AppButton
                  aria-label={sortAsc ? '오름차순 정렬' : '내림차순 정렬'}
                  aria-pressed={sortAsc}
                  onClick={() => setSortAsc((v) => !v)}
                  size="compact-sm"
                  tone="secondary"
                  type="button"
                  style={{ fontVariantNumeric: 'tabular-nums', minWidth: 36 }}
                >
                  {sortAsc ? '↑ ASC' : '↓ DESC'}
                </AppButton>
              </Tooltip>
            )}
          </Group>
        </Group>
      </ArchiveHero>

      {/* ── Status quick-filter (always visible when active scope) ──── */}
      {collectionScope === 'active' && (
        <FilterPillGroup
          aria-label="상태 필터"
          onChange={(status) => onQueryChange({ ...query, status })}
          options={statusFilterOptions}
          value={query.status}
        />
      )}

      {/* ── Active filter chips ──────────────────────────────────────── */}
      {hasActiveFilters && (
        <Group aria-label="적용된 필터" gap="xs" role="group" wrap="wrap">
          {activeFilterChips.map((chip) => (
            <AppButton
              aria-label={`${chip.label} 필터 제거`}
              key={chip.label}
              onClick={chip.onRemove}
              size="compact-xs"
              tone="secondary"
              type="button"
            >
              {chip.label} ×
            </AppButton>
          ))}
          <AppButton onClick={onClearFilters} size="compact-xs" tone="ghost" type="button">
            모두 지우기
          </AppButton>
        </Group>
      )}

      {/* ── Advanced filter toggle ───────────────────────────────────── */}
      <Group justify="flex-end">
        <AppButton
          aria-label={advancedOpen ? '고급 필터 접기' : '고급 필터 펼치기'}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
          rightSection={
            hasActiveFilters && !advancedOpen ? (
              <AppBadge tone="accent">{activeFilterChips.length}</AppBadge>
            ) : undefined
          }
          size="compact-sm"
          tone="ghost"
          type="button"
        >
          {advancedOpen ? '필터 접기 ↑' : '고급 필터 ↓'}
        </AppButton>
      </Group>

      {/* ── Advanced filter panel ────────────────────────────────────── */}
      <Collapse in={advancedOpen}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Stack gap="xs">
            <Text c="dimmed" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              유형
            </Text>
            <FilterPillGroup
              aria-label="유형 필터"
              onChange={(type) => onQueryChange({ ...query, type })}
              options={[
                { label: '전체', value: 'all' as const },
                ...workTypeOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                })),
              ]}
              value={query.type}
            />
          </Stack>

          <Stack gap="xs">
            <Text c="dimmed" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              정렬
            </Text>
            <FilterPillGroup
              aria-label="정렬"
              onChange={(sortBy) => onQueryChange({ ...query, sortBy })}
              options={workSortOptions}
              value={query.sortBy}
            />
          </Stack>

          <Stack gap="xs">
            <Text c="dimmed" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              별점 최소
            </Text>
            <FilterPillGroup
              aria-label="별점 필터"
              onChange={(rating) =>
                onQueryChange({
                  ...query,
                  rating: rating === 'all' ? null : Number.parseFloat(rating),
                })
              }
              options={[
                { label: '전체', value: 'all' },
                ...ratingFilterOptions,
              ]}
              value={query.rating === null ? 'all' : query.rating.toFixed(1)}
            />
          </Stack>

          <Stack gap="xs">
            <Text c="dimmed" fw={800} size="xs" tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              개인 태그
            </Text>
            <TextInput
              list="worksTagFilterSuggestions"
              name="tag"
              onChange={(event) => onQueryChange({ ...query, tag: event.currentTarget.value })}
              placeholder="태그로 필터"
              value={query.tag ?? ''}
            />
            <datalist id="worksTagFilterSuggestions">
              {tagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </Stack>
        </SimpleGrid>
      </Collapse>
    </Stack>
  );
}
