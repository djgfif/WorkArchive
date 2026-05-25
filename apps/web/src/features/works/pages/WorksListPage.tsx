import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { LibraryTemplate } from '@shared/components/PageTemplates';
import { confirmDialogAdapter } from '@shared/runtime/dialog-adapter';
import { JsonBackupReminderCard } from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import { useJsonBackupReminder } from '@features/archive';
import { useAuthSession } from '@features/auth';
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
  getDefaultSortDirection,
  type WorksIdentityPreset,
  type WorksListQuery,
  type WorksRatingPreset,
  type WorksSmartFilter,
} from '../utils/query-works';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';

function normalizeStatusQueryParam(
  value: string | null,
): WorksListQuery['status'] {
  return value &&
    WORK_STATUSES.includes(value as (typeof WORK_STATUSES)[number])
    ? (value as WorksListQuery['status'])
    : DEFAULT_WORKS_LIST_QUERY.status;
}

function normalizeRatingPresetQueryParam(
  value: string | null,
): WorksRatingPreset {
  return value === 'unrated' ||
    value === 'gte4' ||
    value === 'gte3' ||
    value === 'lte2'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.ratingPreset ?? 'all');
}

function normalizeSmartFilterQueryParam(
  value: string | null,
): WorksSmartFilter {
  return value === 'favorites' ||
    value === 'unrated' ||
    value === 'needsCuration'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.smartFilter ?? 'all');
}

function normalizeIdentityPresetQueryParam(
  value: string | null,
): WorksIdentityPreset {
  return value === 'manual' ||
    value === 'imported' ||
    value === 'catalogLinked'
    ? value
    : (DEFAULT_WORKS_LIST_QUERY.identityPreset ?? 'all');
}

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

function getDeletedWorkFromRouteState(state: unknown) {
  if (!state || typeof state !== 'object' || !('deletedWork' in state)) {
    return null;
  }

  const deletedWork = (state as { deletedWork?: unknown }).deletedWork;

  if (!deletedWork || typeof deletedWork !== 'object') {
    return null;
  }

  return deletedWork as WorkRecord;
}

function getQueryFromSearchParams(
  searchParams: URLSearchParams,
): WorksListQuery {
  const ratingFromUrl = Number.parseFloat(searchParams.get('rating') ?? '');
  const statusFromUrl = searchParams.get('status');
  const typeFromUrl = searchParams.get('type');
  const sortByFromUrl = searchParams.get('sort');
  const sortDirectionFromUrl = searchParams.get('dir');
  const sortBy =
    sortByFromUrl === 'title' ||
    sortByFromUrl === 'rating' ||
    sortByFromUrl === 'createdAt' ||
    sortByFromUrl === 'lastConsumedAt' ||
    sortByFromUrl === 'startedAt' ||
    sortByFromUrl === 'completedAt'
      ? sortByFromUrl
      : DEFAULT_WORKS_LIST_QUERY.sortBy;

  return {
    ...DEFAULT_WORKS_LIST_QUERY,
    contributor: searchParams.get('contributor') ?? '',
    genre: searchParams.get('genre') ?? '',
    organizationContributor: searchParams.get('organizationContributor') ?? '',
    personContributor: searchParams.get('personContributor') ?? '',
    identityPreset: normalizeIdentityPresetQueryParam(
      searchParams.get('identity'),
    ),
    rating:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? ratingFromUrl
        : DEFAULT_WORKS_LIST_QUERY.rating,
    ratingPreset:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? 'all'
        : normalizeRatingPresetQueryParam(searchParams.get('ratingPreset')),
    searchTerm: searchParams.get('q') ?? '',
    series: searchParams.get('series') ?? '',
    smartFilter: normalizeSmartFilterQueryParam(searchParams.get('smart')),
    tag: searchParams.get('tag') ?? '',
    sortBy,
    sortDirection:
      sortDirectionFromUrl === 'asc' || sortDirectionFromUrl === 'desc'
        ? sortDirectionFromUrl
        : getDefaultSortDirection(sortBy),
    status: normalizeStatusQueryParam(statusFromUrl),
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
  if (query.personContributor?.trim()) {
    nextSearchParams.set('personContributor', query.personContributor.trim());
  }
  if (query.organizationContributor?.trim()) {
    nextSearchParams.set(
      'organizationContributor',
      query.organizationContributor.trim(),
    );
  }
  if (query.genre?.trim()) nextSearchParams.set('genre', query.genre.trim());
  if (query.status !== 'all') nextSearchParams.set('status', query.status);
  if (query.rating !== null) nextSearchParams.set('rating', query.rating.toString());
  if (query.rating === null && (query.ratingPreset ?? 'all') !== 'all') {
    nextSearchParams.set('ratingPreset', query.ratingPreset ?? 'all');
  }
  if ((query.smartFilter ?? 'all') !== 'all') {
    nextSearchParams.set('smart', query.smartFilter ?? 'all');
  }
  if ((query.identityPreset ?? 'all') !== 'all') {
    nextSearchParams.set('identity', query.identityPreset ?? 'all');
  }
  if (query.tag?.trim()) nextSearchParams.set('tag', query.tag.trim());
  if (query.type !== 'all') nextSearchParams.set('type', query.type);
  if (query.sortBy !== DEFAULT_WORKS_LIST_QUERY.sortBy) {
    nextSearchParams.set('sort', query.sortBy);
  }
  const sortDirection =
    query.sortDirection ?? getDefaultSortDirection(query.sortBy);
  if (sortDirection !== getDefaultSortDirection(query.sortBy)) {
    nextSearchParams.set('dir', sortDirection);
  }
  if (scope === 'trash') nextSearchParams.set('scope', 'trash');
  if (scope === 'active' && viewMode === 'list') nextSearchParams.set('view', 'list');

  return nextSearchParams;
}

export function WorksListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { archiveScopeKey } = useAuthSession();
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<WorkRecord | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const {
    error,
    genreSuggestions,
    isLoading,
    organizationContributorSuggestions,
    personContributorSuggestions,
    retry,
    seriesSuggestions,
    statusCounts,
    tagSuggestions,
    totalActiveCount,
    totalDeletedCount,
    typeCounts,
    works,
  } = useWorksList(query, collectionScope);
  const jsonArchiveExport = useJsonArchiveExport();
  const backupReminder = useJsonBackupReminder(
    totalActiveCount,
    archiveScopeKey,
  );
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
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.sortBy !== 'updatedAt' ||
    (query.sortDirection ?? getDefaultSortDirection(query.sortBy)) !==
      getDefaultSortDirection(query.sortBy);
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

  useEffect(() => {
    const routeDeletedWork = getDeletedWorkFromRouteState(location.state);

    if (!routeDeletedWork) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setDeletedNotice(routeDeletedWork);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

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
      description: '서재에서는 숨겨지고 휴지통에서 다시 복원할 수 있습니다.',
      title: `"${work.title}"을 휴지통으로 이동할까요?`,
    });

    if (!shouldDelete) return;

    try {
      setActionError(null);
      setActionSuccess(null);
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
      setActionSuccess(null);
      setRestoringWorkId(work.id);
      await worksService.restoreWork(work.id);
      setDeletedNotice((currentNotice) =>
        currentNotice?.id === work.id ? null : currentNotice,
      );
      setActionSuccess('되돌렸습니다.');
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
        genreSuggestions={genreSuggestions}
        organizationContributorSuggestions={organizationContributorSuggestions}
        personContributorSuggestions={personContributorSuggestions}
        seriesSuggestions={seriesSuggestions}
        statusCounts={statusCounts}
        tagSuggestions={tagSuggestions}
        totalActiveCount={totalActiveCount}
        totalDeletedCount={totalDeletedCount}
        typeCounts={typeCounts}
        viewMode={viewMode}
      />

      <JsonBackupReminderCard
        feedback={jsonArchiveExport.feedback}
        isExporting={jsonArchiveExport.isExporting}
        onExportJson={jsonArchiveExport.exportJson}
        reminder={backupReminder}
      />

      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      {deletedNotice && collectionScope === 'active' && (
        <FeedbackMessage title="휴지통으로 이동했습니다." tone="success">
          <ActionRow justify="space-between">
            <span>{deletedNotice.title} 기록을 되돌릴 수 있습니다.</span>
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
                  서재로 돌아가기
                </AppButton>
              ) : hasActiveFilters ? (
                <>
                  <AppButton onClick={handleClearFilters} type="button">
                    필터 초기화
                  </AppButton>
                  <AppLinkButton to="/works/new" tone="secondary">
                    직접 추가
                  </AppLinkButton>
                </>
              ) : (
                <>
                  <AppLinkButton to="/works/new" tone="primary">
                    직접 추가
                  </AppLinkButton>
                  <AppButton
                    onClick={() => setAddDialogOpened(true)}
                    tone="secondary"
                    type="button"
                  >
                    검색으로 추가
                  </AppButton>
                  <AppLinkButton to="/account/settings" tone="quiet">
                    JSON 백업 가져오기
                  </AppLinkButton>
                </>
              )}
            </>
          }
          description={
            collectionScope === 'trash'
              ? '삭제한 작품은 이곳에서 다시 확인하거나 복원할 수 있습니다.'
              : hasActiveFilters
                ? '검색어나 필터를 바꿔 다시 찾아보세요.'
                : '제목만 직접 남기거나, 검색으로 기본 정보를 불러오거나, 기존 JSON 백업에서 다시 시작할 수 있습니다.'
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
