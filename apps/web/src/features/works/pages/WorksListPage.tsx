import { Link } from 'react-router-dom';
import { useState } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { useWorksList } from '../hooks/useWorksList';
import { worksService } from '../services/works.service';
import {
  DEFAULT_WORKS_LIST_QUERY,
  type WorksListQuery,
} from '../utils/query-works';
import { WorksList } from '../components/WorksList';
import { WorksToolbar } from '../components/WorksToolbar';

export function WorksListPage() {
  const [query, setQuery] = useState<WorksListQuery>(DEFAULT_WORKS_LIST_QUERY);
  const [actionError, setActionError] = useState<string | null>(null);
  const { error, isLoading, totalActiveCount, works } = useWorksList(query);

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = window.confirm(
      `"${work.title}" 작품을 삭제할까요?`,
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

  return (
    <div className="stack">
      <WorksToolbar
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={() => setQuery(DEFAULT_WORKS_LIST_QUERY)}
        onQueryChange={setQuery}
        query={query}
        totalActiveCount={totalActiveCount}
      />

      {actionError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      {error && (
        <section className="panel stack">
          <h2 className="section-title">라이브러리를 불러오지 못했습니다.</h2>
          <p className="muted-copy">{error}</p>
        </section>
      )}

      {!error && isLoading && (
        <section className="panel stack">
          <h2 className="section-title">라이브러리를 불러오는 중입니다.</h2>
          <p className="muted-copy">데이터를 불러오고 있습니다.</p>
        </section>
      )}

      {!error && !isLoading && works.length === 0 && (
        <section className="panel empty-state">
          <div aria-hidden="true" className="empty-state-art">
            <span>WA</span>
          </div>
          <div className="stack">
            <p className="eyebrow">비어 있는 라이브러리</p>
            <h2 className="section-title">현재 조건에 맞는 작품이 없습니다.</h2>
            <p className="muted-copy">
              {query.searchTerm || query.type !== 'all' || query.status !== 'all'
                ? '검색어나 필터를 조정하거나 새 작품을 추가해보세요.'
                : '아직 등록된 작품이 없습니다. 첫 작품을 추가해보세요.'}
            </p>
            <div className="button-row">
              <Link className="primary-link" to="/works/new">
                작품 추가
              </Link>
              {(query.searchTerm ||
                query.type !== 'all' ||
                query.status !== 'all') && (
                <button
                  onClick={() => setQuery(DEFAULT_WORKS_LIST_QUERY)}
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
        <WorksList onDelete={handleDelete} works={works} />
      )}
    </div>
  );
}
