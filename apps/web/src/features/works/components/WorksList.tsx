import type { WorkRecord } from '@work-archive/shared-types';
import { SimpleGrid, Stack } from '@mantine/core';

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
      <section>
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          {works.map((work) => (
            <WorkCard key={work.id} onDelete={onDelete} work={work} />
          ))}
        </SimpleGrid>
      </section>
    );
  }

  return (
    <section>
      <Stack gap="md">
        {works.map((work) => (
          <WorkListRow
            isUpdating={updatingWorkId === work.id}
            key={work.id}
            onDelete={onDelete}
            onQuickUpdate={onQuickUpdate}
            work={work}
          />
        ))}
      </Stack>
    </section>
  );
}
