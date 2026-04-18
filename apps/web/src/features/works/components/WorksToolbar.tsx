import { Link } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import type { WorksListQuery } from '../utils/query-works';
import {
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface WorksToolbarProps {
  filteredCount: number;
  isLoading: boolean;
  onClearFilters: () => void;
  onQueryChange: (query: WorksListQuery) => void;
  query: WorksListQuery;
  totalActiveCount: number;
}

export function WorksToolbar({
  filteredCount,
  isLoading,
  onClearFilters,
  onQueryChange,
  query,
  totalActiveCount,
}: WorksToolbarProps) {
  let countSummary = '라이브러리를 불러오는 중입니다.';

  if (!isLoading) {
    if (totalActiveCount === 0) {
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

  return (
    <section className="stack">
      <PageHero
        actions={
          <>
            {hasActiveFilters && (
              <button onClick={onClearFilters} type="button">
                초기화
              </button>
            )}
            <Link className="primary-link" to="/works/new">
              작품 추가
            </Link>
          </>
        }
        description="기록한 작품을 빠르게 찾고, 상태별로 정리해보세요."
        eyebrow="라이브러리"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{totalActiveCount}</span>
              <span className="stat-pill-label">전체 작품</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{filteredCount}</span>
              <span className="stat-pill-label">현재 결과</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">
                {workSortOptions.find((option) => option.value === query.sortBy)?.label}
              </span>
              <span className="stat-pill-label">정렬 기준</span>
            </div>
          </>
        }
        title="내 라이브러리"
      />

      <section className="panel stack toolbar-panel">
        <div className="toolbar-header">
          <div>
            <h3 className="section-title">필터와 정렬</h3>
            <p className="muted-copy">{countSummary}</p>
          </div>
        </div>

        <label className="field search-field" htmlFor="searchTerm">
          <span>작품 검색</span>
          <input
            id="searchTerm"
            name="searchTerm"
            onChange={(event) =>
              onQueryChange({ ...query, searchTerm: event.target.value })
            }
            placeholder="제목 또는 작가로 검색"
            value={query.searchTerm}
          />
        </label>

        <div className="toolbar-grid">
          <label className="field" htmlFor="typeFilter">
            <span>유형</span>
            <select
              id="typeFilter"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  type: event.target.value as WorksListQuery['type'],
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
            </select>
          </label>

          <label className="field" htmlFor="statusFilter">
            <span>상태</span>
            <select
              id="statusFilter"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  status: event.target.value as WorksListQuery['status'],
                })
              }
              value={query.status}
            >
              <option value="all">전체 상태</option>
              {workStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="sortBy">
            <span>정렬</span>
            <select
              id="sortBy"
              onChange={(event) =>
                onQueryChange({
                  ...query,
                  sortBy: event.target.value as WorksListQuery['sortBy'],
                })
              }
              value={query.sortBy}
            >
              {workSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </section>
  );
}
