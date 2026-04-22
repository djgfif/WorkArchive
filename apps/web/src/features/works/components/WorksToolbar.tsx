import { Badge, Group, NativeSelect, SimpleGrid, Text, TextInput } from '@mantine/core';

import type { WorkStatus } from '@work-archive/shared-types';

import {
  ActionBar,
  ActionRow,
  AppButton,
  AppLinkButton,
  MetricPill,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import type { WorksListQuery } from '../utils/query-works';
import {
  getWorkStatusLabel,
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';
import type { WorksCollectionScope } from '../services/works.service';

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
    <section className="stack">
      <PageHero
        actions={
          <>
            {hasActiveFilters && (
              <AppButton onClick={onClearFilters} type="button">
                초기화
              </AppButton>
            )}
            <AppLinkButton to="/works/new" tone="primary">
              작품 추가
            </AppLinkButton>
          </>
        }
        description={
          collectionScope === 'trash'
            ? '삭제한 작품을 바로 지우지 않고 잠시 숨겨두는 공간입니다. 필요하면 복원하고, 아니면 그대로 보관할 수 있습니다.'
            : '기록과 수정을 빠르게 이어갈 수 있도록 리스트 중심으로 정리한 아카이브 작업 공간입니다.'
        }
        eyebrow="작품"
        meta={
          <>
            <MetricPill label="전체 작품" value={totalActiveCount} />
            <MetricPill label="휴지통" value={totalDeletedCount} />
            <MetricPill
              label={collectionScope === 'trash' ? '현재 범위' : '보기 방식'}
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
        title="작품"
      />

      <ActionBar
        actions={
          <ActionRow justify="flex-end">
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
            {collectionScope === 'active' && (
              <>
                <AppButton
                  onClick={() => onViewModeChange('list')}
                  tone={viewMode === 'list' ? 'ghost' : 'secondary'}
                  type="button"
                >
                  리스트
                </AppButton>
                <AppButton
                  onClick={() => onViewModeChange('grid')}
                  tone={viewMode === 'grid' ? 'ghost' : 'secondary'}
                  type="button"
                >
                  그리드
                </AppButton>
              </>
            )}
          </ActionRow>
        }
        description={
          <>
            {countSummary}{' '}
            {collectionScope === 'trash'
              ? '삭제한 작품은 여기서 다시 복원할 수 있습니다.'
              : viewMode === 'list'
                ? '기본은 관리 중심 리스트입니다.'
                : '그리드는 표지 중심 탐색용입니다.'}
          </>
        }
        eyebrow={collectionScope === 'trash' ? '휴지통' : '작업 공간'}
        title={collectionScope === 'trash' ? '휴지통 관리' : '찾기와 정리'}
      >
        {collectionScope === 'active' ? (
          <Group gap="sm" wrap="wrap">
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
                  tone={isActive ? 'primary' : 'ghost'}
                  type="button"
                >
                  {option.label}
                  <Badge color={isActive ? 'gray' : 'archive'} variant="white">
                    {count}
                  </Badge>
                </AppButton>
              );
            })}
          </Group>
        ) : (
          <SectionCard gap="sm" padding="lg">
            <Badge color="archive" w="fit-content">
              현재는 소프트 삭제
            </Badge>
            <Text c="var(--app-text-muted)">
              작품을 삭제해도 바로 사라지지 않고 휴지통에 보관됩니다. 복원하면 상태,
              별점, 리뷰를 그대로 되돌릴 수 있습니다.
            </Text>
          </SectionCard>
        )}

        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
          <TextInput
            label="작품 검색"
            name="searchTerm"
            onChange={(event) =>
              onQueryChange({ ...query, searchTerm: event.currentTarget.value })
            }
            placeholder="제목 또는 작가로 검색"
            value={query.searchTerm}
          />

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
        </SimpleGrid>

        <SectionCard gap="sm" padding="lg">
          <Badge color="archive" w="fit-content">
            {collectionScope === 'trash'
              ? '휴지통'
              : viewMode === 'list'
                ? '기본 보기'
                : '보조 보기'}
          </Badge>
          <Text c="var(--app-text-muted)">
            {collectionScope === 'trash'
              ? '숨겨둔 작품을 확인하고, 필요하면 복원하는 용도로만 정리했습니다.'
              : viewMode === 'list'
                ? '리스트 뷰에서는 상태와 별점을 바로 바꿀 수 있습니다.'
                : '그리드 뷰는 표지 중심으로 둘러볼 때 더 편합니다.'}
          </Text>
          <Text c="var(--app-text-secondary)" fw={600}>
            {collectionScope === 'trash'
              ? '영구 삭제 규칙은 아직 확정되지 않았습니다. 지금은 복원 가능한 보관함으로 사용합니다.'
              : '삭제한 작품은 먼저 휴지통으로 이동합니다. 목록 관리와 복원은 같은 작품 영역 안에서 처리합니다.'}
          </Text>
        </SectionCard>
      </ActionBar>
    </section>
  );
}
