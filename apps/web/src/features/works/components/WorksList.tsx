import type { WorkRecord } from '@work-archive/shared-types';

import { WorkCard } from './WorkCard';
import { WorkListRow, type WorkQuickUpdate } from './WorkListRow';

export type WorksViewMode = 'grid' | 'list';

interface WorksListProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  updatingWorkId: string | null;
  viewMode: WorksViewMode;
  works: WorkRecord[];
}

export function WorksList({
  onDelete,
  onQuickUpdate,
  updatingWorkId,
  viewMode,
  works,
}: WorksListProps) {
  if (viewMode === 'grid') {
    return (
      <section className="works-section">
        <div className="works-grid">
          {works.map((work) => (
            <WorkCard key={work.id} onDelete={onDelete} work={work} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="works-section">
      <div className="works-list-shell">
        <div aria-hidden="true" className="works-list-head">
          <span>표지</span>
          <span>제목</span>
          <span>타입</span>
          <span>별점</span>
          <span>상태</span>
          <span>관리</span>
        </div>

        <div className="works-list-stack">
          {works.map((work) => (
            <WorkListRow
              isUpdating={updatingWorkId === work.id}
              key={work.id}
              onDelete={onDelete}
              onQuickUpdate={onQuickUpdate}
              work={work}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
