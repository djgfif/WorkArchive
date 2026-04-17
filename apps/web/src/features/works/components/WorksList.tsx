import type { WorkRecord } from '@work-archive/shared-types';

import { WorkCard } from './WorkCard';

interface WorksListProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  works: WorkRecord[];
}

export function WorksList({ onDelete, works }: WorksListProps) {
  return (
    <div className="works-grid">
      {works.map((work) => (
        <WorkCard key={work.id} onDelete={onDelete} work={work} />
      ))}
    </div>
  );
}
