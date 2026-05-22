import type { WorkRecord } from '@work-archive/shared-types';
import { Box, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

import { AppButton } from '../../../shared/components/AppPrimitives';
import { WorkPosterCard } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  WorkListRow,
  type WorkQuickProgressUpdate,
  type WorkQuickUpdate,
} from './WorkListRow';

export type WorksViewMode = 'grid' | 'list';

const GRID_RENDER_LIMIT = 60;
const LIST_RENDER_LIMIT = 40;
const RENDER_INCREMENT = 40;
const css = styles as Record<string, string>;

interface WorksListProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickProgressUpdate: (
    work: WorkRecord,
    update: WorkQuickProgressUpdate,
  ) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  updatingWorkId: string | null;
  viewMode: WorksViewMode;
  works: WorkRecord[];
}

export function WorksList({
  onDelete,
  onQuickProgressUpdate,
  onQuickUpdate,
  updatingWorkId,
  viewMode,
  works,
}: WorksListProps) {
  const renderLimit = viewMode === 'grid' ? GRID_RENDER_LIMIT : LIST_RENDER_LIMIT;
  const workListSignature = useMemo(
    () => works.map((work) => work.id).join('|'),
    [works],
  );
  const [visibleCount, setVisibleCount] = useState(renderLimit);
  const visibleWorks = useMemo(
    () => works.slice(0, visibleCount),
    [visibleCount, works],
  );
  const hasHiddenWorks = visibleWorks.length < works.length;

  useEffect(() => {
    setVisibleCount(renderLimit);
  }, [renderLimit, workListSignature]);

  function handleShowMore() {
    setVisibleCount((currentCount) =>
      Math.min(currentCount + RENDER_INCREMENT, works.length),
    );
  }

  const renderProgress =
    works.length > renderLimit ? (
      <Paper className={css.loadMoreControl ?? ''} withBorder>
        <Group justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <Text fw={800}>
              {visibleWorks.length} / {works.length}개
            </Text>
            <Text c="dimmed" size="sm">
              포스터 목록은 필요한 만큼만 나누어 보여줍니다.
            </Text>
          </Stack>
          {hasHiddenWorks && (
            <AppButton
              aria-label={`작품 ${Math.min(
                RENDER_INCREMENT,
                works.length - visibleWorks.length,
              )}개 더 보기`}
              onClick={handleShowMore}
              tone="secondary"
              type="button"
            >
              더 보기
            </AppButton>
          )}
        </Group>
      </Paper>
    ) : null;

  if (viewMode === 'grid') {
    return (
      <Stack aria-label="작품 포스터 목록" component="section" gap="xl">
        <SimpleGrid
          cols={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
          spacing={{ base: 'md', md: 'lg' }}
          verticalSpacing="lg"
        >
          {visibleWorks.map((work) => (
            <Box key={work.id} style={{ position: 'relative' }}>
              <WorkPosterCard
                isUpdating={updatingWorkId === work.id}
                work={work}
              />
            </Box>
          ))}
        </SimpleGrid>
        {renderProgress}
      </Stack>
    );
  }

  return (
    <section aria-label="작품 리스트">
      <Stack gap="sm">
        {visibleWorks.map((work, index) => (
          <Group align="flex-start" gap="sm" key={work.id} wrap="nowrap">
            <Box flex={1} miw={0}>
              <WorkListRow
                isLast={index === visibleWorks.length - 1}
                isUpdating={updatingWorkId === work.id}
                onDelete={onDelete}
                onQuickProgressUpdate={onQuickProgressUpdate}
                onQuickUpdate={onQuickUpdate}
                work={work}
              />
            </Box>
          </Group>
        ))}
      </Stack>
      {renderProgress}
    </section>
  );
}
