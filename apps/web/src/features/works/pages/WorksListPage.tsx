import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppButton,
  FeedbackMessage,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { LibraryTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import {
  ArchiveEmptyState,
  ArchiveSkeleton,
} from '../components/ArchiveComponents';
import { AddWorkDialog } from '../components/AddWorkDialog';
import { WorksList, type WorksViewMode } from '../components/WorksList';
import type { WorkQuickProgressUpdate } from '../components/WorkListRow';
import { WorksToolbar } from '../components/WorksToolbar';
import { WorksTrashList } from '../components/WorksTrashList';
import { useWorksList } from '../hooks/useWorksList';
import {
  worksService,
  type WorksCollectionScope,
} from '../services/works.service';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';

function getCollectionScopeFromSearchParams(
  searchParams: URLSearchParams,
): WorksCollectionScope {
  return searchParams.get('scope') === 'trash' ? 'trash' : 'active';
}

function getViewModeFromSearchParams(
  searchParams: URLSearchParams,
): WorksViewMode {
  return searchParams.get('view') === 'list' ? 'list' : 'grid';
}

function getQueryFromSearchParams(
  searchParams: URLSearchParams,
): WorksListQuery {
  const ratingFromUrl = Number.parseFloat(searchParams.get('rating') ?? '');
  const statusFromUrl = searchParams.get('status');
  const typeFromUrl = searchParams.get('type');
  const sortByFromUrl = searchParams.get('sort');

  return {
    ...DEFAULT_WORKS_LIST_QUERY,
    contributor: searchParams.get('contributor') ?? '',
    genre: searchParams.get('genre') ?? '',
    rating:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? ratingFromUrl
        : DEFAULT_WORKS_LIST_QUERY.rating,
    searchTerm: searchParams.get('q') ?? '',
    series: searchParams.get('series') ?? '',
    tag: searchParams.get('tag') ?? '',
    sortBy:
      sortByFromUrl === 'title' || sortByFromUrl === 'rating'
        ? sortByFromUrl
        : DEFAULT_WORKS_LIST_QUERY.sortBy,
    status:
      statusFromUrl &&
      WORK_STATUSES.includes(statusFromUrl as (typeof WORK_STATUSES)[number])
        ? (statusFromUrl as WorksListQuery['status'])
        : DEFAULT_WORKS_LIST_QUERY.status,
    type:
      typeFromUrl &&
      WORK_TYPES.includes(typeFromUrl as (typeof WORK_TYPES)[number])
        ? (typeFromUrl as WorksListQuery['type'])
        : DEFAULT_WORKS_LIST_QUERY.type,
  };
}

function buildSearchParams(
  query: WorksListQuery,
  scope: WorksCollectionScope,
  viewMode: WorksViewMode,
) {
  const nextSearchParams = new URLSearchParams();

  if (query.searchTerm.trim()) nextSearchParams.set('q', query.searchTerm.trim());
  if (query.series?.trim()) nextSearchParams.set('series', query.series.trim());
  if (query.contributor?.trim()) {
    nextSearchParams.set('contributor', query.contributor.trim());
  }
  if (query.genre?.trim()) nextSearchParams.set('genre', query.genre.trim());
  if (query.status !== 'all') nextSearchParams.set('status', query.status);
  if (query.rating !== null) nextSearchParams.set('rating', query.rating.toString());
  if (query.tag?.trim()) nextSearchParams.set('tag', query.tag.trim());
  if (query.type !== 'all') nextSearchParams.set('type', query.type);
  if (query.sortBy !== DEFAULT_WORKS_LIST_QUERY.sortBy) {
    nextSearchParams.set('sort', query.sortBy);
  }
  if (scope === 'trash') nextSearchParams.set('scope', 'trash');
  if (scope === 'active' && viewMode === 'list') nextSearchParams.set('view', 'list');

  return nextSearchParams;
}

export function WorksListPage() {
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
  const [addDialogOpened, setAddDialogOpened] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<WorkRecord | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const {
    contributorSuggestions,
    error,
    genreSuggestions,
    isLoading,
    retry,
    seriesSuggestions,
    statusCounts,
    tagSuggestions,
    totalActiveCount,
    totalDeletedCount,
    works,
  } = useWorksList(query, collectionScope);
  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    (query.series?.trim() ?? '') !== '' ||
    (query.contributor?.trim() ?? '') !== '' ||
    (query.genre?.trim() ?? '') !== '' ||
    (query.tag?.trim() ?? '') !== '' ||
    query.rating !== null ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.sortBy !== 'updatedAt';

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

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '목록에서는 숨겨지고 휴지통에서 다시 복원할 수 있습니다.',
      title: `"${work.title}"을 휴지통으로 이동할까요?`,
    });

    if (!shouldDelete) return;

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      setDeletedNotice(work);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleRestore(work: WorkRecord) {
    try {
      setActionError(null);
      setRestoringWorkId(work.id);
      await worksService.restoreWork(work.id);
      setDeletedNotice((currentNotice) =>
        currentNotice?.id === work.id ? null : currentNotice,
      );
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : '작품을 복원하지 못했습니다.',
      );
    } finally {
      setRestoringWorkId(null);
    }
  }

  async function handleQuickUpdate(
    work: WorkRecord,
    nextValues: {
      favorite?: boolean;
      rating?: number | null;
      status?: WorkRecord['status'];
    },
  ) {
    try {
      setActionError(null);
      setUpdatingWorkId(work.id);

      const latestWork = await worksService.getWorkById(work.id);
      if (!latestWork) throw new Error('작품을 찾을 수 없습니다.');

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '작품을 바로 수정하지 못했습니다.',
      );
    } finally {
      setUpdatingWorkId(null);
    }
  }

  async function handleQuickProgressUpdate(
    work: WorkRecord,
    nextValues: WorkQuickProgressUpdate,
  ) {
    if (
      nextValues.progressCurrent !== null &&
      nextValues.progressTotal !== null &&
      nextValues.progressCurrent > nextValues.progressTotal
    ) {
      setActionError('현재 진행량이 전체 진행량보다 클 수 없습니다.');
      return;
    }

    try {
      setActionError(null);
      setUpdatingWorkId(work.id);
      await worksService.updateProgress(work.id, nextValues);
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '진행도를 바로 수정하지 못했습니다.',
      );
    } finally {
      setUpdatingWorkId(null);
    }
  }

  return (
    <LibraryTemplate>
      <WorksToolbar
        collectionScope={collectionScope}
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={handleClearFilters}
        onCollectionScopeChange={handleCollectionScopeChange}
        onCreateWork={() => setAddDialogOpened(true)}
        onQueryChange={handleQueryChange}
        onViewModeChange={handleViewModeChange}
        query={query}
        contributorSuggestions={contributorSuggestions}
        genreSuggestions={genreSuggestions}
        seriesSuggestions={seriesSuggestions}
        statusCounts={statusCounts}
        tagSuggestions={tagSuggestions}
        totalActiveCount={totalActiveCount}
        totalDeletedCount={totalDeletedCount}
        viewMode={viewMode}
      />

      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}

      {deletedNotice && collectionScope === 'active' && (
        <FeedbackMessage title="목록에서 숨겼습니다" tone="success">
          <ActionRow justify="space-between">
            <span>{deletedNotice.title}은 휴지통에서 복원할 수 있습니다.</span>
            <ActionRow justify="flex-end">
              <AppButton
                disabled={restoringWorkId === deletedNotice.id}
                onClick={() => void handleRestore(deletedNotice)}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                되돌리기
              </AppButton>
              <AppButton
                onClick={() => setDeletedNotice(null)}
                size="compact-sm"
                tone="ghost"
                type="button"
              >
                닫기
              </AppButton>
            </ActionRow>
          </ActionRow>
        </FeedbackMessage>
      )}

      {error && (
        <StateMessage
          actions={
            <>
              <AppButton onClick={retry} tone="primary" type="button">
                다시 불러오기
              </AppButton>
              <AppButton
                aria-label="목록 오류 상태에서 작품 추가"
                onClick={() => setAddDialogOpened(true)}
                tone="secondary"
                type="button"
              >
                작품 추가
              </AppButton>
            </>
          }
          description={error}
          title="작품 목록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {!error && isLoading && (
        <ArchiveSkeleton count={collectionScope === 'trash' ? 4 : 10} />
      )}

      {!error && !isLoading && works.length === 0 && (
        <ArchiveEmptyState
          actions={
            <>
              {collectionScope === 'trash' ? (
                <AppButton onClick={() => handleCollectionScopeChange('active')} type="button">
                  작품 목록
                </AppButton>
              ) : (
                <AppButton
                  onClick={() => setAddDialogOpened(true)}
                  tone="primary"
                  type="button"
                >
                  작품 추가
                </AppButton>
              )}
              {hasActiveFilters && collectionScope === 'active' && (
                <AppButton onClick={handleClearFilters} type="button">
                  초기화
                </AppButton>
              )}
            </>
          }
          description={
            collectionScope === 'trash'
              ? '숨긴 작품은 이곳에서 다시 확인하거나 복원할 수 있습니다.'
              : hasActiveFilters
                ? '검색어나 필터를 바꿔 다시 찾아보세요.'
                : '아직 등록된 작품이 없습니다. 검색과 추가 흐름에서 바로 시작할 수 있습니다.'
          }
          eyebrow={
            collectionScope === 'trash'
              ? '휴지통'
              : hasActiveFilters
                ? '검색 결과 없음'
                : '빈 선반'
          }
          title={
            collectionScope === 'trash'
              ? '휴지통이 비어 있습니다.'
              : hasActiveFilters
                ? '조건에 맞는 작품이 없습니다.'
                : '아직 기록한 작품이 없습니다.'
          }
        />
      )}

      {!error &&
        !isLoading &&
        works.length > 0 &&
        (collectionScope === 'trash' ? (
          <WorksTrashList
            onRestore={handleRestore}
            restoringWorkId={restoringWorkId}
            works={works}
          />
        ) : (
          <WorksList
            onDelete={handleDelete}
            onQuickProgressUpdate={handleQuickProgressUpdate}
            onQuickUpdate={handleQuickUpdate}
            updatingWorkId={updatingWorkId}
            viewMode={viewMode}
            works={works}
          />
        ))}

      <AddWorkDialog
        onClose={() => setAddDialogOpened(false)}
        opened={addDialogOpened}
      />
    </LibraryTemplate>
  );
}
