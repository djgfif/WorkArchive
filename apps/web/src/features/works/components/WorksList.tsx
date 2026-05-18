import type { WorkRecord } from '@work-archive/shared-types';
import { Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

import { AppButton, MetricPill } from '../../../shared/components/AppPrimitives';
import { PosterTile } from './PosterTile';
import {
  WorkListRow,
  type WorkQuickProgressUpdate,
  type WorkQuickUpdate,
} from './WorkListRow';

export type WorksViewMode = 'grid' | 'list';

const GRID_RENDER_LIMIT = 60;
const LIST_RENDER_LIMIT = 40;
const RENDER_INCREMENT = 40;

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
      <Paper
        p="md"
        radius="md"
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-default)',
            borderColor: 'var(--mantine-color-default-border)',
          },
        }}
        withBorder
      >
        <Group justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <MetricPill
              label="표시 중"
              value={`${visibleWorks.length} / ${works.length}개`}
            />
            <Text c="var(--mantine-color-dimmed)" fz="sm">
              많은 기록은 필요한 만큼만 이어서 불러와 목록 조작이 느려지지 않게 합니다.
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
      <section aria-label="작품 카드 목록">
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} spacing="md">
          {visibleWorks.map((work) => (
            <PosterTile key={work.id} work={work} />
          ))}
        </SimpleGrid>
        {renderProgress}
      </section>
    );
  }

  return (
    <section aria-label="작품 행 목록">
      <Paper
        p={0}
        radius="lg"
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-body)',
            borderColor: 'var(--mantine-color-default-border)',
            overflow: 'hidden',
          },
        }}
        withBorder
      >
        <Stack gap={0}>
          {visibleWorks.map((work, index) => (
            <WorkListRow
              isLast={index === visibleWorks.length - 1}
              isUpdating={updatingWorkId === work.id}
              key={work.id}
              onDelete={onDelete}
              onQuickProgressUpdate={onQuickProgressUpdate}
              onQuickUpdate={onQuickUpdate}
              work={work}
            />
          ))}
        </Stack>
      </Paper>
      {renderProgress}
    </section>
  );
}
