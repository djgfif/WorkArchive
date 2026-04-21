import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  FeedbackMessage,
  SectionCard,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { WorkspacePageTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { WorksList, type WorksViewMode } from '../components/WorksList';
import { WorksTrashList } from '../components/WorksTrashList';
import { WorksToolbar } from '../components/WorksToolbar';
import { useWorksList } from '../hooks/useWorksList';
import {
  worksService,
  type WorksCollectionScope,
} from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';

function getCollectionScopeFromSearchParams(searchParams: URLSearchParams): WorksCollectionScope {
  return searchParams.get('scope') === 'trash' ? 'trash' : 'active';
}

function getQueryFromSearchParams(searchParams: URLSearchParams): WorksListQuery {
  const statusFromUrl = searchParams.get('status');
  const typeFromUrl = searchParams.get('type');
  const sortByFromUrl = searchParams.get('sort');

  return {
    ...DEFAULT_WORKS_LIST_QUERY,
    searchTerm: searchParams.get('q') ?? '',
    sortBy:
      sortByFromUrl === 'title' || sortByFromUrl === 'rating'
        ? sortByFromUrl
        : DEFAULT_WORKS_LIST_QUERY.sortBy,
    status:
      statusFromUrl && WORK_STATUSES.includes(statusFromUrl as (typeof WORK_STATUSES)[number])
        ? (statusFromUrl as WorksListQuery['status'])
        : DEFAULT_WORKS_LIST_QUERY.status,
    type:
      typeFromUrl && WORK_TYPES.includes(typeFromUrl as (typeof WORK_TYPES)[number])
        ? (typeFromUrl as WorksListQuery['type'])
        : DEFAULT_WORKS_LIST_QUERY.type,
  };
}

function buildSearchParams(
  query: WorksListQuery,
  scope: WorksCollectionScope,
) {
  const nextSearchParams = new URLSearchParams();

  if (query.searchTerm.trim()) {
    nextSearchParams.set('q', query.searchTerm.trim());
  }

  if (query.status !== 'all') {
    nextSearchParams.set('status', query.status);
  }

  if (query.type !== 'all') {
    nextSearchParams.set('type', query.type);
  }

  if (query.sortBy !== DEFAULT_WORKS_LIST_QUERY.sortBy) {
    nextSearchParams.set('sort', query.sortBy);
  }

  if (scope === 'trash') {
    nextSearchParams.set('scope', 'trash');
  }

  return nextSearchParams;
}

export function WorksListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [collectionScope, setCollectionScope] = useState<WorksCollectionScope>(() =>
    getCollectionScopeFromSearchParams(searchParams),
  );
  const [query, setQuery] = useState<WorksListQuery>(() =>
    getQueryFromSearchParams(searchParams),
  );
  const [viewMode, setViewMode] = useState<WorksViewMode>('list');
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const {
    error,
    isLoading,
    statusCounts,
    totalActiveCount,
    totalDeletedCount,
    works,
  } = useWorksList(query, collectionScope);
  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.sortBy !== 'updatedAt';

  useEffect(() => {
    const nextQuery = getQueryFromSearchParams(searchParams);
    const nextScope = getCollectionScopeFromSearchParams(searchParams);

    setCollectionScope((currentScope) =>
      currentScope === nextScope ? currentScope : nextScope,
    );
    setQuery((currentQuery) =>
      JSON.stringify(currentQuery) === JSON.stringify(nextQuery)
        ? currentQuery
        : nextQuery,
    );
  }, [searchParams]);

  function handleQueryChange(nextQuery: WorksListQuery) {
    setQuery(nextQuery);
    setSearchParams(buildSearchParams(nextQuery, collectionScope), {
      replace: true,
    });
  }

  function handleCollectionScopeChange(nextScope: WorksCollectionScope) {
    setCollectionScope(nextScope);
    setSearchParams(buildSearchParams(query, nextScope), {
      replace: true,
    });
  }

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '현재는 목록에서 숨겨집니다.',
      title: `"${work.title}"을 삭제할까요?`,
    });

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
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
      rating?: number | null;
      status?: WorkRecord['status'];
    },
  ) {
    try {
      setActionError(null);
      setUpdatingWorkId(work.id);

      const latestWork = await worksService.getWorkById(work.id);

      if (!latestWork) {
        throw new Error('작품을 찾을 수 없습니다.');
      }

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

  return (
    <WorkspacePageTemplate>
      <WorksToolbar
        collectionScope={collectionScope}
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={() => {
          setQuery(DEFAULT_WORKS_LIST_QUERY);
          setSearchParams(buildSearchParams(DEFAULT_WORKS_LIST_QUERY, collectionScope), {
            replace: true,
          });
        }}
        onCollectionScopeChange={handleCollectionScopeChange}
        onQueryChange={handleQueryChange}
        onViewModeChange={setViewMode}
        query={query}
        statusCounts={statusCounts}
        totalActiveCount={totalActiveCount}
        totalDeletedCount={totalDeletedCount}
        viewMode={viewMode}
      />

      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}

      {error && (
        <StateMessage
          description={error}
          title="작품 목록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {!error && isLoading && (
        <StateMessage
          description="잠시만 기다려주세요."
          title="작품 목록을 불러오는 중입니다."
          tone="loading"
        />
      )}

      {!error && !isLoading && works.length === 0 && (
        <StateMessage
          actions={
            <>
              {collectionScope === 'trash' ? (
                <button
                  onClick={() => {
                    handleCollectionScopeChange('active');
                  }}
                  type="button"
                >
                  작품 목록 보기
                </button>
              ) : (
                <Link className="primary-link" to="/works/new">
                  작품 추가
                </Link>
              )}
              {hasActiveFilters && collectionScope === 'active' && (
                <button
                  onClick={() => {
                    setQuery(DEFAULT_WORKS_LIST_QUERY);
                    setSearchParams(
                      buildSearchParams(DEFAULT_WORKS_LIST_QUERY, collectionScope),
                      { replace: true },
                    );
                  }}
                  type="button"
                >
                  초기화
                </button>
              )}
            </>
          }
          description={
            collectionScope === 'trash'
              ? '작품을 삭제하면 여기에서 복원하거나 다시 확인할 수 있습니다.'
              : hasActiveFilters
                ? '검색어나 필터를 조금만 바꿔보세요.'
                : '첫 작품을 추가해 내 아카이브를 채워보세요.'
          }
          eyebrow={
            collectionScope === 'trash'
              ? '휴지통 비어 있음'
              : hasActiveFilters
                ? '검색 결과 없음'
                : '아직 없음'
          }
          title={
            collectionScope === 'trash'
              ? '숨겨둔 작품이 없습니다.'
              : hasActiveFilters
                ? '조건에 맞는 작품이 없습니다.'
                : '아직 등록된 작품이 없습니다.'
          }
          tone="info"
        />
      )}

      {!error &&
        !isLoading &&
        collectionScope === 'active' &&
        totalDeletedCount > 0 && (
          <SectionCard className="works-trash-surface" tone="subtle">
            <div className="works-trash-surface-copy">
              <p className="section-kicker">휴지통</p>
              <h2 className="section-title">숨겨둔 작품 {totalDeletedCount}개</h2>
              <p className="muted-copy">
                삭제한 작품은 바로 사라지지 않고 이 작품 영역 안의 휴지통에
                남습니다. 필요하면 복원해서 다시 관리할 수 있습니다.
              </p>
            </div>

            <ActionRow>
              <button
                onClick={() => handleCollectionScopeChange('trash')}
                type="button"
              >
                휴지통 보기
              </button>
            </ActionRow>
          </SectionCard>
        )}

      {!error && !isLoading && works.length > 0 && (
        collectionScope === 'trash' ? (
          <WorksTrashList
            onRestore={handleRestore}
            restoringWorkId={restoringWorkId}
            works={works}
          />
        ) : (
          <WorksList
            onDelete={handleDelete}
            onQuickUpdate={handleQuickUpdate}
            updatingWorkId={updatingWorkId}
            viewMode={viewMode}
            works={works}
          />
        )
      )}
    </WorkspacePageTemplate>
  );
}
