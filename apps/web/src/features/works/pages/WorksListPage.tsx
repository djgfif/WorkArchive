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
  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    query.type !== 'all' ||
    query.status !== 'all';

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = window.confirm(`"${work.title}"을 삭제할까요?`);

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
                : '첫 작품을 추가해 내 라이브러리를 채워보세요.'}
            </p>
            <div className="button-row">
              <Link className="primary-link" to="/works/new">
                작품 추가
              </Link>
              {hasActiveFilters && (
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
