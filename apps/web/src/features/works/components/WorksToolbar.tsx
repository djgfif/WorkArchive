import { Group, NativeSelect, SimpleGrid, Text, TextInput } from '@mantine/core';

import type { WorkStatus } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  MetricPill,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
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
        countSummary = '지금은 휴지통이 비어 있습니다.';
      } else if (filteredCount === totalDeletedCount) {
        countSummary = `숨겨둔 작품 ${totalDeletedCount}개를 보고 있습니다.`;
      } else {
        countSummary = `휴지통 ${totalDeletedCount}개 중 ${filteredCount}개를 보고 있습니다.`;
      }
    } else if (totalActiveCount === 0) {
      countSummary = '아직 등록된 작품이 없습니다. 첫 작품을 추가해보세요.';
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
    <>
      <PageHero
        actions={
          <ActionRow justify="flex-end">
            {hasActiveFilters && (
              <AppButton onClick={onClearFilters} tone="quiet" type="button">
                초기화
              </AppButton>
            )}
            <AppLinkButton to="/works/new" tone="primary">
              작품 추가
            </AppLinkButton>
          </ActionRow>
        }
        description={
          collectionScope === 'trash'
            ? '삭제한 작품을 잠시 보관하고 복원하는 공간입니다.'
            : '검색과 상태 변경을 빠르게 이어가는 작품 아카이브 작업 공간입니다.'
        }
        eyebrow="작품"
        meta={
          <>
            <MetricPill label="전체 작품" value={totalActiveCount} />
            <MetricPill label="휴지통" value={totalDeletedCount} />
            <MetricPill
              label={collectionScope === 'trash' ? '현재 범위' : '기본 보기'}
              value={
                collectionScope === 'trash'
                  ? '휴지통'
                  : viewMode === 'list'
                    ? '리스트'
                    : '그리드'
              }
            />
          </>
        }
        title="작품 아카이브"
      />

      <SectionCard gap="md" padding="lg" tone="subtle">
        <SimpleGrid cols={{ base: 1, lg: 12 }} spacing="md">
          <div style={{ gridColumn: 'span 12 / span 12' }}>
            <Group align="flex-end" gap="sm" wrap="wrap">
              <div style={{ flex: '1 1 18rem', minWidth: 220 }}>
                <TextInput
                  label="작품 검색"
                  name="searchTerm"
                  onChange={(event) =>
                    onQueryChange({ ...query, searchTerm: event.currentTarget.value })
                  }
                  placeholder="제목 또는 작가로 검색"
                  value={query.searchTerm}
                />
              </div>

              <div style={{ minWidth: 160 }}>
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

              <div style={{ minWidth: 160 }}>
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
          </div>

          <div style={{ gridColumn: 'span 12 / span 12' }}>
            <Group gap="sm" justify="space-between" wrap="wrap">
              <ActionRow>
                <AppButton
                  onClick={() => onCollectionScopeChange('active')}
                  tone={collectionScope === 'active' ? 'primary' : 'secondary'}
                  type="button"
                >
                  작품 목록
                </AppButton>
                <AppButton
                  onClick={() => onCollectionScopeChange('trash')}
                  tone={collectionScope === 'trash' ? 'primary' : 'secondary'}
                  type="button"
                >
                  {totalDeletedCount > 0 ? `휴지통 ${totalDeletedCount}` : '휴지통'}
                </AppButton>
              </ActionRow>

              {collectionScope === 'active' && (
                <ActionRow justify="flex-end">
                  <AppButton
                    onClick={() => onViewModeChange('list')}
                    tone={viewMode === 'list' ? 'quiet' : 'secondary'}
                    type="button"
                  >
                    리스트
                  </AppButton>
                  <AppButton
                    onClick={() => onViewModeChange('grid')}
                    tone={viewMode === 'grid' ? 'quiet' : 'secondary'}
                    type="button"
                  >
                    그리드
                  </AppButton>
                </ActionRow>
              )}
            </Group>
          </div>

          {collectionScope === 'active' && (
            <div style={{ gridColumn: 'span 12 / span 12' }}>
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
                      tone={isActive ? 'primary' : 'quiet'}
                      type="button"
                    >
                      {option.label}
                      <AppBadge tone={isActive ? 'default' : 'muted'}>{count}</AppBadge>
                    </AppButton>
                  );
                })}
              </ActionRow>
            </div>
          )}
        </SimpleGrid>

        <Text c="var(--app-text-muted)">{countSummary}</Text>
      </SectionCard>
    </>
  );
}
