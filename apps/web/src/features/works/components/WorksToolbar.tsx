import { Link } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import type { WorksListQuery } from '../utils/query-works';
import {
  getWorkStatusLabel,
  workSortOptions,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';
import type { WorksViewMode } from './WorksList';

interface WorksToolbarProps {
  filteredCount: number;
  isLoading: boolean;
  onClearFilters: () => void;
  onQueryChange: (query: WorksListQuery) => void;
  onViewModeChange: (viewMode: WorksViewMode) => void;
  query: WorksListQuery;
  totalActiveCount: number;
  viewMode: WorksViewMode;
}

export function WorksToolbar({
  filteredCount,
  isLoading,
  onClearFilters,
  onQueryChange,
  onViewModeChange,
  query,
  totalActiveCount,
  viewMode,
}: WorksToolbarProps) {
  let countSummary = '작품을 불러오는 중입니다.';

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
              <button onClick={onClearFilters} type="button">
                초기화
              </button>
            )}
            <Link className="primary-link" to="/works/new">
              작품 추가
            </Link>
          </>
        }
        description="기록과 수정을 빠르게 이어갈 수 있도록 리스트 중심으로 정리한 아카이브 작업 공간입니다."
        eyebrow="작품"
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
              <span className="stat-pill-value">{viewMode === 'list' ? '리스트' : '그리드'}</span>
              <span className="stat-pill-label">보기 방식</span>
            </div>
          </>
        }
        title="작품"
      />

      <section className="panel stack toolbar-panel">
        <div className="toolbar-header">
          <div>
            <h3 className="section-title">찾기와 정리</h3>
            <p className="muted-copy">{countSummary}</p>
          </div>

          <div aria-label="보기 방식" className="segmented-control" role="group">
            <button
              className={viewMode === 'list' ? 'segment-button active' : 'segment-button'}
              onClick={() => onViewModeChange('list')}
              type="button"
            >
              리스트
            </button>
            <button
              className={viewMode === 'grid' ? 'segment-button active' : 'segment-button'}
              onClick={() => onViewModeChange('grid')}
              type="button"
            >
              그리드
            </button>
          </div>
        </div>

        <div className="toolbar-chip-row" role="group" aria-label="상태 빠른 필터">
          {statusFilterOptions.map((option) => {
            const isActive = query.status === option.value;

            return (
              <button
                className={isActive ? 'filter-chip active' : 'filter-chip'}
                key={option.value}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    status: option.value,
                  })
                }
                type="button"
              >
                {option.label}
              </button>
            );
          })}
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

          <div className="workspace-hint-card">
            <span className="mode-badge">관리 우선</span>
            <p className="muted-copy">
              리스트 뷰에서는 상태와 별점을 바로 바꿀 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
