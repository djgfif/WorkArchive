import type { WorkRecord } from '@work-archive/shared-types';
import { Paper, SimpleGrid, Stack } from '@mantine/core';

import { PosterTile } from './PosterTile';
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
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} spacing="md">
          {works.map((work) => (
            <PosterTile key={work.id} work={work} />
          ))}
        </SimpleGrid>
      </section>
    );
  }

  return (
    <section>
      <Paper
        p={0}
        radius="lg"
        styles={{
          root: {
            backgroundColor: 'var(--app-surface-0)',
            borderColor: 'var(--app-border-color)',
            overflow: 'hidden',
          },
        }}
        withBorder
      >
        <Stack gap={0}>
          {works.map((work, index) => (
            <WorkListRow
              isLast={index === works.length - 1}
              isUpdating={updatingWorkId === work.id}
              key={work.id}
              onDelete={onDelete}
              onQuickUpdate={onQuickUpdate}
              work={work}
            />
          ))}
        </Stack>
      </Paper>
    </section>
  );
}
