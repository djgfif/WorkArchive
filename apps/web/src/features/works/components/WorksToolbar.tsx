import { Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';

import type { WorkStatus } from '@work-archive/shared-types';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
  MetricPill,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import type { WorksCollectionScope } from '../services/works.service';
import type { WorksListQuery } from '../utils/query-works';
import {
  getWorkStatusLabel,
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';

interface WorksToolbarProps {
  collectionScope: WorksCollectionScope;
  filteredCount: number;
  isLoading: boolean;
  onClearFilters: () => void;
  onCollectionScopeChange: (scope: WorksCollectionScope) => void;
  onQueryChange: (query: WorksListQuery) => void;
  onViewModeChange: (viewMode: WorksViewMode) => void;
  query: WorksListQuery;
  statusCounts: Record<WorkStatus, number>;
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
  onQueryChange,
  onViewModeChange,
  query,
  statusCounts,
  totalActiveCount,
  totalDeletedCount,
  viewMode,
}: WorksToolbarProps) {
  let countSummary = '작품을 불러오는 중입니다.';

  if (!isLoading) {
    if (collectionScope === 'trash') {
      if (totalDeletedCount === 0) {
        countSummary = '휴지통은 비어 있습니다.';
      } else if (filteredCount === totalDeletedCount) {
        countSummary = `숨겨둔 작품 ${totalDeletedCount}개를 보고 있습니다.`;
      } else {
        countSummary = `휴지통 ${totalDeletedCount}개 중 ${filteredCount}개를 보고 있습니다.`;
      }
    } else if (totalActiveCount === 0) {
      countSummary = '아직 등록된 작품이 없습니다. 검색과 추가 흐름에서 바로 시작할 수 있습니다.';
    } else if (filteredCount === totalActiveCount) {
      countSummary = `작품 ${totalActiveCount}개가 등록되어 있습니다.`;
    } else {
      countSummary = `전체 ${totalActiveCount}개 중 ${filteredCount}개를 보고 있습니다.`;
    }
  }

  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    query.status !== 'all' ||
    query.type !== 'all' ||
    query.sortBy !== 'updatedAt';

  const statusFilterOptions = [
    { label: '전체', value: 'all' as const },
    ...workStatusOptions.map((option) => ({
      label: getWorkStatusLabel(option.value),
      value: option.value,
    })),
  ];

  return (
    <SectionCard gap="md" padding="lg" tone="subtle">
      <Group align="flex-start" justify="space-between" wrap="wrap">
        <Stack gap={4}>
          <Title order={1}>작품</Title>
          <Text c="var(--app-text-muted)">{countSummary}</Text>
        </Stack>

        <ActionRow justify="flex-end">
          {hasActiveFilters && (
            <AppButton onClick={onClearFilters} size="compact-sm" tone="ghost" type="button">
              초기화
            </AppButton>
          )}
          <AppLinkButton size="compact-sm" to="/works/new" tone="primary">
            작품 추가
          </AppLinkButton>
        </ActionRow>
      </Group>

      <Group gap="xs" wrap="wrap">
        <MetricPill label="활성" value={totalActiveCount} />
        <MetricPill label="휴지통" value={totalDeletedCount} />
        <MetricPill
          label="보기"
          value={collectionScope === 'trash' ? '휴지통' : viewMode === 'list' ? '리스트' : '그리드'}
        />
      </Group>

      <Group align="flex-end" gap="sm" wrap="wrap">
        <div style={{ flex: '1 1 20rem', minWidth: 'min(100%, 20rem)' }}>
          <TextInput
            label="검색"
            name="searchTerm"
            onChange={(event) =>
              onQueryChange({ ...query, searchTerm: event.currentTarget.value })
            }
            placeholder="제목 또는 작가"
            value={query.searchTerm}
          />
        </div>

        <div style={{ flex: '0 1 10rem', minWidth: 144 }}>
          <NativeSelect
            id="typeFilter"
            label="유형"
            onChange={(event) =>
              onQueryChange({
                ...query,
                type: event.currentTarget.value as WorksListQuery['type'],
              })
            }
            value={query.type}
          >
            <option value="all">전체 유형</option>
            {workTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div style={{ flex: '0 1 10rem', minWidth: 144 }}>
          <NativeSelect
            id="sortBy"
            label="정렬"
            onChange={(event) =>
              onQueryChange({
                ...query,
                sortBy: event.currentTarget.value as WorksListQuery['sortBy'],
              })
            }
            value={query.sortBy}
          >
            {workSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Group>

      <Group gap="sm" justify="space-between" wrap="wrap">
        <ActionRow>
          <AppButton
            onClick={() => onCollectionScopeChange('active')}
            size="compact-sm"
            tone={collectionScope === 'active' ? 'quiet' : 'ghost'}
            type="button"
          >
            작품 목록
          </AppButton>
          <AppButton
            onClick={() => onCollectionScopeChange('trash')}
            size="compact-sm"
            tone={collectionScope === 'trash' ? 'quiet' : 'ghost'}
            type="button"
          >
            {totalDeletedCount > 0 ? `휴지통 ${totalDeletedCount}` : '휴지통'}
          </AppButton>
        </ActionRow>

        {collectionScope === 'active' && (
          <ActionRow justify="flex-end">
            <AppButton
              onClick={() => onViewModeChange('list')}
              size="compact-sm"
              tone={viewMode === 'list' ? 'quiet' : 'ghost'}
              type="button"
            >
              리스트
            </AppButton>
            <AppButton
              onClick={() => onViewModeChange('grid')}
              size="compact-sm"
              tone={viewMode === 'grid' ? 'quiet' : 'ghost'}
              type="button"
            >
              그리드
            </AppButton>
          </ActionRow>
        )}
      </Group>

      {collectionScope === 'active' && (
        <ActionRow>
          {statusFilterOptions.map((option) => {
            const isActive = query.status === option.value;
            const count =
              option.value === 'all' ? totalActiveCount : statusCounts[option.value];

            return (
              <AppButton
                key={option.value}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    status: option.value,
                  })
                }
                size="compact-sm"
                tone={isActive ? 'quiet' : 'ghost'}
                type="button"
              >
                {option.label} {count}
              </AppButton>
            );
          })}
        </ActionRow>
      )}
    </SectionCard>
  );
}
