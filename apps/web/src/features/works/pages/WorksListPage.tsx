import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { WorksList, type WorksViewMode } from '../components/WorksList';
import { WorksToolbar } from '../components/WorksToolbar';
import { useWorksList } from '../hooks/useWorksList';
import { worksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';

export function WorksListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTermFromUrl = searchParams.get('q') ?? '';
  const [query, setQuery] = useState<WorksListQuery>(() => ({
    ...DEFAULT_WORKS_LIST_QUERY,
    searchTerm: searchTermFromUrl,
  }));
  const [viewMode, setViewMode] = useState<WorksViewMode>('list');
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const { error, isLoading, totalActiveCount, works } = useWorksList(query);
  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.sortBy !== 'updatedAt';

  useEffect(() => {
    setQuery((currentQuery) =>
      currentQuery.searchTerm === searchTermFromUrl
        ? currentQuery
        : {
            ...currentQuery,
            searchTerm: searchTermFromUrl,
          },
    );
  }, [searchTermFromUrl]);

  function handleQueryChange(nextQuery: WorksListQuery) {
    setQuery(nextQuery);
    setSearchParams(
      nextQuery.searchTerm.trim() ? { q: nextQuery.searchTerm.trim() } : {},
      {
        replace: true,
      },
    );
  }

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = window.confirm(
      `"${work.title}"을 삭제할까요?\n현재는 목록에서 숨겨집니다.`,
    );

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

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(work),
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
    <div className="stack">
      <WorksToolbar
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={() => {
          setQuery(DEFAULT_WORKS_LIST_QUERY);
          setSearchParams({}, { replace: true });
        }}
        onQueryChange={handleQueryChange}
        onViewModeChange={setViewMode}
        query={query}
        totalActiveCount={totalActiveCount}
        viewMode={viewMode}
      />

      {actionError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      {error && (
        <section className="panel stack">
          <h2 className="section-title">작품 목록을 불러오지 못했습니다.</h2>
          <p className="muted-copy">{error}</p>
        </section>
      )}

      {!error && isLoading && (
        <section className="panel stack">
          <h2 className="section-title">작품 목록을 불러오는 중입니다.</h2>
          <p className="muted-copy">잠시만 기다려주세요.</p>
        </section>
      )}

      {!error && !isLoading && works.length === 0 && (
        <section className="panel empty-state">
          <div aria-hidden="true" className="empty-state-art">
            <span>WA</span>
          </div>
          <div className="stack">
            <p className="eyebrow">{hasActiveFilters ? '검색 결과 없음' : '아직 없음'}</p>
            <h2 className="section-title">
              {hasActiveFilters
                ? '조건에 맞는 작품이 없습니다.'
                : '아직 등록된 작품이 없습니다.'}
            </h2>
            <p className="muted-copy">
              {hasActiveFilters
                ? '검색어나 필터를 조금만 바꿔보세요.'
                : '첫 작품을 추가해 내 아카이브를 채워보세요.'}
            </p>
            <div className="button-row">
              <Link className="primary-link" to="/works/new">
                작품 추가
              </Link>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setQuery(DEFAULT_WORKS_LIST_QUERY);
                    setSearchParams({}, { replace: true });
                  }}
                  type="button"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {!error && !isLoading && works.length > 0 && (
        <WorksList
          onDelete={handleDelete}
          onQuickUpdate={handleQuickUpdate}
          updatingWorkId={updatingWorkId}
          viewMode={viewMode}
          works={works}
        />
      )}
    </div>
  );
}
